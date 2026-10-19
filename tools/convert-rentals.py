"""
convert-rentals.py — turns the Kaggle "Australian Rental Market Data 2026" download into data/rentals.js

Dataset: https://www.kaggle.com/datasets/kanchana1990/australian-rental-market-data-2026
The site can't read Kaggle directly (it needs a login + API key), so we convert a
downloaded copy once and ship the result as a static file.

Usage (from the front-end-back folder), with the .json or .csv from Kaggle:
    python3 tools/convert-rentals.py path/to/australian_rental_market_2026.json
    python3 tools/convert-rentals.py path/to/australian_rental_market_2026.json --region rated

--region picks which listings to keep:
    rated     (default) only the suburbs listed in data/suburbs.js, so every listing has a fit score
              (build-suburbs.py scores every Queensland suburb with a listing, so today that is all of them)
    qld       every Queensland listing
    brisbane  Queensland listings within 40 km of the Brisbane CBD
    all       every listing in Australia

Why a .js file and not .json: browsers block fetch() of local .json files when the
site is opened straight from disk (file://), but a <script> file always loads.
It also writes data/rental-details.js (each listing's description and amenities, keyed by id),
which only the listing page loads, so the other pages stay light.
The downloaded dataset itself is NOT needed by the website, so keep it out of the uploaded folder.
"""
import argparse
import html
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUBURBS_JS = ROOT / 'data' / 'suburbs.js'
OUT = ROOT / 'data' / 'rentals.js'
DETAILS_OUT = ROOT / 'data' / 'rental-details.js'

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


def plain_text(value):
    """Listing descriptions come as HTML: keep the line breaks, drop the tags and entities."""
    text = re.sub(r'<br\s*/?>', '\n', str(value or ''), flags=re.I)
    text = html.unescape(re.sub(r'<[^>]+>', '', text))
    text = re.sub(r'[ \t]+', ' ', text)
    return re.sub(r'\n\s*\n\s*\n+', '\n\n', text).strip()


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
        if region in ('qld', 'rated') and not is_qld:
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
            '_details': {'description': plain_text(row.get('description')),
                         'amenities': str(row.get('amenities') or '').strip()},
        })

    listings.sort(key=lambda l: (l['suburb'], l['price'], l['street']))
    for i, l in enumerate(listings, 1):
        l['id'] = 'k%04d' % i
    # Ids are numbered across every Queensland listing first, so a listing keeps the same id
    # (and saved listings keep working) whichever region is picked.
    if region == 'rated':
        listings = [l for l in listings if l['slug'] in rated]

    details = {l['id']: l.pop('_details') for l in listings}
    DETAILS_OUT.write_text(
        '/* Listing descriptions and amenities for the listing page (listing.html), keyed by listing id.\n'
        '   Generated by tools/convert-rentals.py from the same Kaggle snapshot as data/rentals.js. Do not edit by hand. */\n'
        'window.SM = window.SM || {};\n'
        'SM.RENTAL_DETAILS = {\n' + ',\n'.join('  %s: %s' % (json.dumps(k), json.dumps(v, ensure_ascii=False)) for k, v in details.items()) + '\n};\n',
        encoding='utf-8')

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
    parser.add_argument('--region', choices=['qld', 'brisbane', 'all', 'rated'], default='rated')
    args = parser.parse_args()
    main(args.dataset, args.region)
