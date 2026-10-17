"""
convert-rentals.py — turns the Kaggle "Australian Rental Market Data 2026" download into data/rentals.js

Dataset: https://www.kaggle.com/datasets/kanchana1990/australian-rental-market-data-2026
The site can't read Kaggle directly (it needs a login + API key), so we convert a
downloaded copy once and ship the result as a static file.

Usage (from the front-end-back folder), with the .json or .csv from Kaggle:
    python3 tools/convert-rentals.py path/to/australian_rental_market_2026.json
    python3 tools/convert-rentals.py path/to/australian_rental_market_2026.json --region qld

--region picks which listings to keep:
    qld       (default) every Queensland listing
    brisbane  Queensland listings within 40 km of the Brisbane CBD
    all       every listing in Australia
    rated     only the suburbs listed in data/suburbs.js

Why a .js file and not .json: browsers block fetch() of local .json files when the
site is opened straight from disk (file://), but a <script> file always loads.
The downloaded dataset itself is NOT needed by the website, so keep it out of the uploaded folder.
"""
import argparse
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUBURBS_JS = ROOT / 'data' / 'suburbs.js'
OUT = ROOT / 'data' / 'rentals.js'

CBD = (-27.4698, 153.0251)
BRISBANE_RADIUS_KM = 40

# Prices outside this range ($/week) are almost certainly typos or monthly prices.
MIN_PRICE, MAX_PRICE = 100, 5000

TYPE_LABELS = {
    'duplex/semi-detached': 'Duplex',
    'acreage/semi-rural': 'Acreage',
}


def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def rated_suburbs():
    """slug -> postcode for the suburbs that have scores in data/suburbs.js."""
    text = SUBURBS_JS.read_text(encoding='utf-8')
    return dict(re.findall(r"slug: '([^']+)',.*?postcode: '([^']+)'", text))


def km(lat1, lng1, lat2, lng2):
    rad = math.radians
    h = math.sin(rad(lat2 - lat1) / 2) ** 2 + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(rad(lng2 - lng1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def read_rows(path):
    if path.suffix.lower() == '.json':
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def main(path, region):
    rated = rated_suburbs()
    rows = read_rows(path)
    # Some names are used by more than one suburb (e.g. West End in Brisbane and in Townsville).
    postcodes_by_name = {}
    for row in rows:
        key = (str(row.get('suburb') or '').strip().lower(), str(row.get('state') or '').strip().lower())
        postcodes_by_name.setdefault(key, set()).add(str(row.get('postcode') or '').strip())

    listings, skipped = [], 0
    for row in rows:
        state = str(row.get('state') or '').strip()
        name = str(row.get('suburb') or '').strip()
        if not name:
            skipped += 1
            continue
        is_qld = state.lower() == 'qld'
        # Same suburb name can exist in two states, so non-Queensland slugs carry the state.
        postcode = str(row.get('postcode') or '').strip()
        slug = slugify(name) if is_qld else slugify(name + ' ' + state)
        shared_name = len(postcodes_by_name[(name.lower(), state.lower())]) > 1
        if (slug in rated and rated[slug] != postcode) or (slug not in rated and shared_name):
            slug += '-' + postcode
        try:
            price = round(float(row['price_display']))
            lat, lng = float(row['latitude']), float(row['longitude'])
        except (TypeError, ValueError, KeyError):
            skipped += 1
            continue
        if not MIN_PRICE <= price <= MAX_PRICE:
            skipped += 1
            continue

        if region == 'brisbane' and not (is_qld and km(CBD[0], CBD[1], lat, lng) <= BRISBANE_RADIUS_KM):
            continue
        if region == 'qld' and not is_qld:
            continue
        if region == 'rated' and not (is_qld and slug in rated):
            continue

        kind = str(row.get('propertyType') or '').strip().lower()
        listings.append({
            'title': str(row.get('title') or '').strip(),
            'type': TYPE_LABELS.get(kind, kind.capitalize() or 'Other'),
            'price': price,
            'beds': to_int(row.get('bedrooms')),
            'baths': to_int(row.get('bathrooms')),
            'cars': to_int(row.get('parking_spaces')),
            'street': str(row.get('street_address') or '').strip(),
            'suburb': name,
            'slug': slug,
            'postcode': postcode,
            'state': state.upper(),
            'lat': round(lat, 6),
            'lng': round(lng, 6),
            'agency': str(row.get('agency_name') or '').strip(),
        })

    listings.sort(key=lambda l: (l['suburb'], l['price'], l['street']))
    for i, l in enumerate(listings, 1):
        l['id'] = 'k%04d' % i

    lines = ',\n'.join('  ' + json.dumps(l, ensure_ascii=False) for l in listings)
    OUT.write_text(
        '/* ==========================================================================\n'
        '   RENTAL LISTINGS (generated, do not edit by hand)\n'
        '   Source: "Australian Rental Market Data 2026" by kanchana1990 on Kaggle\n'
        '   https://www.kaggle.com/datasets/kanchana1990/australian-rental-market-data-2026\n'
        '   A one-off snapshot, not live. Region: ' + region + '.\n'
        '   Rebuild with: python3 tools/convert-rentals.py <dataset.json> --region ' + region + '\n'
        '   Fields: price = $ per week; slug matches data/suburbs.js for the suburbs we score.\n'
        '   ========================================================================== */\n'
        'window.SM = window.SM || {};\n'
        'SM.RENTALS = [\n' + lines + '\n];\n',
        encoding='utf-8')

    in_rated = sum(1 for l in listings if l['slug'] in rated)
    print('Wrote %d listings in %d suburbs to %s' % (len(listings), len({l['slug'] for l in listings}), OUT))
    print('  %d are in the %d suburbs we score; skipped %d rows with a bad price or location' % (in_rated, len(rated), skipped))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('dataset', type=Path, help='the .json or .csv downloaded from Kaggle')
    parser.add_argument('--region', choices=['qld', 'brisbane', 'all', 'rated'], default='qld')
    args = parser.parse_args()
    main(args.dataset, args.region)
