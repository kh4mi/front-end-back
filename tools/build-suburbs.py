"""
build-suburbs.py — builds data/suburbs.js: every Brisbane City Council suburb, plus every other
Queensland suburb that has a rental listing, with real transport, safety and affordability scores.

Usage (from the front-end-back folder):
    python3 tools/build-suburbs.py
    python3 tools/build-suburbs.py path/to/australian_rental_market_2026.json
The second form first rewrites tools/listing-suburbs.csv (the Queensland suburbs that have listings) from
the Kaggle download; without it the existing csv is used.

It downloads its sources into tools/.cache/ the first time (about 60 MB, not needed by the website):
  - Suburb boundaries: Queensland localities (PSMA/Geoscape, via github.com/tonywr71/GeoJson-Data)
      used for each suburb's centre point and area
  - Postcodes: github.com/matthewproctor/australianpostcodes
  - Translink GTFS stops: data/stops.txt (already in this repo)
  - Queensland Police Service open crime data, reported offence rates by police division
      https://open-crime-data.s3-ap-southeast-2.amazonaws.com/Crime%20Statistics/division_Reported_Offences_Rates.csv
    and the police division boundaries
      https://open-crime-data.s3-ap-southeast-2.amazonaws.com/document/QPS_DIVISIONS.zip
  - ABS 2021 Census General Community Profile, Suburbs and Localities, Queensland (tools/census/, already in this repo)
      G01 (population, age groups, birthplace) and G02 (medians), and SAL names from the geography descriptions file
      https://www.abs.gov.au/census/find-census-data/datapacks

Scores are 1–10 and are RANKS across all the scored suburbs (10 = best of the list), not absolute ratings.
A score is null ("No data") where a source doesn't reach: Translink stops only cover South East Queensland.
  transport: bus stops per km² inside the suburb, ranked, +2 for a train station and +1 for a
             ferry terminal in the suburb or within 1 km of its centre (capped at 10)
  safety:    offences against the person + property per 100,000 people over the last 12 months,
             for the police division the suburb centre is in, ranked (lowest = 10)
  afford:    median weekly rent from the 2021 Census, ranked (cheapest = 10)
Parks (Brisbane City Council API) are worked out in the browser, see js/app.js.

After running this, re-run tools/convert-rentals.py so listings link to the new suburbs.
"""
import csv
import json
import math
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'tools' / '.cache'
OUT = ROOT / 'data' / 'suburbs.js'
STOPS = ROOT / 'data' / 'stops.txt'
CENSUS = ROOT / 'tools' / 'census'
LISTING_SUBURBS = ROOT / 'tools' / 'listing-suburbs.csv'

SOURCES = {
    'boundaries.geojson': 'https://raw.githubusercontent.com/tonywr71/GeoJson-Data/master/suburb-10-qld.geojson',
    'postcodes.csv': 'https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.csv',
    'qps-rates.csv': 'https://open-crime-data.s3-ap-southeast-2.amazonaws.com/Crime%20Statistics/division_Reported_Offences_Rates.csv',
    'qps-divisions.zip': 'https://open-crime-data.s3-ap-southeast-2.amazonaws.com/document/QPS_DIVISIONS.zip',
}

CBD = (-27.4698, 153.0251)
NEAR_KM = 1.0
TRANSLINK_KM = 5.0  # a suburb with no Translink stop this close is outside the GTFS area (no transport score)

# Brisbane City Council suburbs. Left out: places with (almost) no homes, e.g. Brisbane Airport,
# Port of Brisbane, Mount Coot-tha, Moreton Island, Enoggera Reservoir, Lake Manchester.
BCC_SUBURBS = (
    'Acacia Ridge|Albion|Alderley|Algester|Annerley|Anstead|Archerfield|Ascot|Ashgrove|Aspley|Auchenflower|'
    'Bald Hills|Balmoral|Banyo|Bardon|Bellbowrie|Belmont|Boondall|Bowen Hills|Bracken Ridge|Bridgeman Downs|'
    'Brighton|Brisbane City|Brookfield|Bulimba|Burbank|Calamvale|Camp Hill|Cannon Hill|Carina|Carina Heights|'
    'Carindale|Carseldine|Chandler|Chapel Hill|Chelmer|Chermside|Chermside West|Clayfield|Coopers Plains|'
    'Coorparoo|Corinda|Darra|Deagon|Doolandella|Drewvale|Durack|Dutton Park|Eagle Farm|East Brisbane|'
    'Eight Mile Plains|Ellen Grove|Enoggera|Everton Park|Fairfield|Ferny Grove|Fig Tree Pocket|Fitzgibbon|'
    'Forest Lake|Fortitude Valley|Gaythorne|Geebung|Gordon Park|Graceville|Grange|Greenslopes|Gumdale|Hamilton|'
    'Hawthorne|Heathwood|Hemmant|Hendra|Herston|Highgate Hill|Holland Park|Holland Park West|Inala|'
    'Indooroopilly|Jamboree Heights|Jindalee|Kalinga|Kangaroo Point|Karana Downs|Karawatha|Kedron|Kelvin Grove|'
    'Kenmore|Kenmore Hills|Keperra|Kholo|Kuraby|Lota|Lutwyche|Lytton|MacGregor|Mackenzie|Manly|Manly West|'
    'Mansfield|McDowall|Middle Park|Milton|Mitchelton|Moggill|Moorooka|Morningside|Mount Crosby|Mount Gravatt|'
    'Mount Gravatt East|Mount Ommaney|Murarrie|Nathan|New Farm|Newmarket|Newstead|Norman Park|Northgate|Nudgee|'
    'Nudgee Beach|Nundah|Oxley|Paddington|Pallara|Parkinson|Petrie Terrace|Pinjarra Hills|Pinkenba|Pullenvale|'
    'Ransome|Red Hill|Richlands|Riverhills|Robertson|Rochedale|Rocklea|Runcorn|Salisbury|Sandgate|Seven Hills|'
    'Seventeen Mile Rocks|Sherwood|Shorncliffe|Sinnamon Park|South Brisbane|Spring Hill|St Lucia|Stafford|'
    'Stafford Heights|Stretton|Sumner|Sunnybank|Sunnybank Hills|Taigum|Taringa|Tarragindi|Teneriffe|Tennyson|'
    'The Gap|Tingalpa|Toowong|Upper Brookfield|Upper Kedron|Upper Mount Gravatt|Virginia|Wacol|Wakerley|'
    'Wavell Heights|West End|Westlake|Willawong|Wilston|Windsor|Wishart|Woolloongabba|Wooloowin|Wynnum|'
    'Wynnum West|Yeerongpilly|Yeronga|Zillmere'
).split('|')

SAFETY_COLUMNS = ['Offences Against the Person', 'Offences Against Property']


def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def km(a, b):
    rad = math.radians
    h = math.sin(rad(b[0] - a[0]) / 2) ** 2 + math.cos(rad(a[0])) * math.cos(rad(b[0])) * math.sin(rad(b[1] - a[1]) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def source(name):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print('Downloading', SOURCES[name])
        urllib.request.urlretrieve(SOURCES[name], path)
    return path


# ---- polygons -------------------------------------------------------------
def rings_of(geometry):
    """List of polygons, each a list of rings of (lat, lng)."""
    polys = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    return [[[(pt[1], pt[0]) for pt in ring] for ring in poly] for poly in polys]


def to_xy(lat, lng, lat0):
    """Local flat projection in km (fine at suburb scale)."""
    return (lng * 111.32 * math.cos(math.radians(lat0)), lat * 110.574)


def ring_area_centroid(ring, lat0):
    pts = [to_xy(lat, lng, lat0) for lat, lng in ring]
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a /= 2
    if not a:
        return 0.0, None
    return abs(a), (cy / (6 * a) / 110.574, cx / (6 * a) / (111.32 * math.cos(math.radians(lat0))))


def in_ring(lat, lng, ring):
    inside = False
    for (y1, x1), (y2, x2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def in_polys(lat, lng, polys):
    return any(in_ring(lat, lng, p[0]) and not any(in_ring(lat, lng, h) for h in p[1:]) for p in polys)


def shape(feature):
    polys = rings_of(feature['geometry'])
    lat0 = polys[0][0][0][0]
    area, best, best_area = 0.0, None, -1
    for p in polys:
        a, c = ring_area_centroid(p[0], lat0)
        holes = sum(ring_area_centroid(h, lat0)[0] for h in p[1:])
        area += a - holes
        if a > best_area:
            best_area, best = a, c
    # The centre must be inside the suburb (an L-shaped suburb's centroid can fall outside it).
    if not in_polys(best[0], best[1], polys):
        ring = max(polys, key=lambda p: ring_area_centroid(p[0], lat0)[0])[0]
        best = min(ring, key=lambda pt: km(pt, best))
    lats = [pt[0] for p in polys for pt in p[0]]
    lngs = [pt[1] for p in polys for pt in p[0]]
    return {'polys': polys, 'area': area, 'centre': best, 'bbox': (min(lats), max(lats), min(lngs), max(lngs))}


# ---- scoring helpers -------------------------------------------------------
def rank_scores(values, higher_is_better=True):
    """values -> 1–10 by rank (ties share a score)."""
    n = len(values)
    out = []
    for v in values:
        worse = sum(1 for o in values if (o < v if higher_is_better else o > v))
        out.append(max(1, min(10, 1 + round(9 * worse / (n - 1)))))
    return out


def police_divisions():
    """Division name (upper case) -> polygons, from the QPS KML file."""
    ns = '{http://www.opengis.net/kml/2.2}'
    with zipfile.ZipFile(source('qps-divisions.zip')) as z:
        root = ET.fromstring(z.read(next(n for n in z.namelist() if n.lower().endswith('.kml'))))
    out = {}
    for pm in root.iter(ns + 'Placemark'):
        name = pm.find(ns + 'name').text.strip().upper()
        polys = []
        for poly in pm.iter(ns + 'Polygon'):
            rings = []
            for tag in ('outerBoundaryIs', 'innerBoundaryIs'):
                for ring in poly.iter(ns + tag):
                    coords = ring.find('.//' + ns + 'coordinates').text.split()
                    rings.append([(float(c.split(',')[1]), float(c.split(',')[0])) for c in coords])
            polys.append(rings)
        out.setdefault(name, []).extend(polys)
    return out


AGE_GROUPS = [('0_4', '0–4'), ('5_14', '5–14'), ('15_19', '15–19'), ('20_24', '20–24'), ('25_34', '25–34'),
              ('35_44', '35–44'), ('45_54', '45–54'), ('55_64', '55–64'), ('65_74', '65–74'), ('75_84', '75–84'), ('85ov', '85+')]


def census():
    """ABS 2021 Census figures by suburb name (upper case). A Brisbane suburb is called e.g. 'Ascot (Brisbane - Qld)'
    or 'Hamilton (Qld)' when the name exists in another state or town, so those labels win over other towns."""
    def rows(name):
        with open(CENSUS / name, encoding='utf-8-sig') as fh:
            return {r['SAL_CODE_2021']: r for r in csv.DictReader(fh)}
    g01, g02 = rows('2021Census_G01_QLD_SAL.csv'), rows('2021Census_G02_QLD_SAL.csv')
    by_name, rank, areas = {}, {}, {}
    with open(CENSUS / 'sal-names-qld.csv', encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            m = re.match(r'^(.*?)(?: \((.*)\))?$', r['SAL_NAME_2021'])
            name, where = m.group(1).upper(), m.group(2) or ''
            if r['SAL_CODE_2021'] not in g01:
                continue
            areas.setdefault(name, []).append((r['SAL_CODE_2021'], float(r['AREA_SQKM'] or 0)))
            score = 2 if where in ('', 'Qld') else 3 if where.startswith('Brisbane') else 1
            if score > rank.get(name, 0):
                rank[name] = score
                by_name[name] = r['SAL_CODE_2021']
    out = {}
    for code in {c for codes in areas.values() for c, _ in codes}:
        a, b = g01[code], g02.get(code, {})
        num = lambda r, k: float(r.get(k) or 0)
        pop = int(num(a, 'Tot_P_P'))
        if not pop:
            continue
        top = max(AGE_GROUPS, key=lambda g: num(a, 'Age_%s_yr_P' % g[0] if g[0] != '85ov' else 'Age_85ov_P'))
        born = num(a, 'Birthplace_Australia_P') + num(a, 'Birthplace_Elsewhere_P')
        out[code] = {
            'code': code, 'population': pop,
            'medianAge': int(num(b, 'Median_age_persons')) or None,
            'topAgeGroup': top[1],
            'bornOverseas': round(100 * num(a, 'Birthplace_Elsewhere_P') / born) if born else None,
            'householdSize': num(b, 'Average_household_size') or None,
            'householdIncome': int(num(b, 'Median_tot_hhd_inc_weekly')) or None,
            'rent': int(num(b, 'Median_rent_weekly')) or None,
            'mortgage': int(num(b, 'Median_mortgage_repay_monthly')) or None,
        }
        if pop < 100:  # a median of a handful of people (Lytton, Eagle Farm) says nothing about the suburb
            out[code].update({k: None for k in ('medianAge', 'topAgeGroup', 'bornOverseas', 'householdSize', 'householdIncome', 'rent', 'mortgage')})

    def lookup(name, area=None):
        """Census figures for a suburb name. A Brisbane suburb uses the Brisbane-labelled match; for a town
        outside Brisbane whose name is used more than once, the census area closest in size to its boundary wins."""
        name = name.upper()
        if area is None or len(areas.get(name, [])) < 2:
            return out.get(by_name.get(name))
        code = min(areas[name], key=lambda ca: abs(math.log((ca[1] or 0.01) / (area or 0.01))))[0]
        return out.get(code)
    return lookup


def census_js(c):
    if not c:
        return 'null'
    keys = ['code', 'population', 'medianAge', 'topAgeGroup', 'bornOverseas', 'householdSize', 'householdIncome', 'rent', 'mortgage']
    return '{ ' + ', '.join('%s: %s' % (k, json.dumps(c[k], ensure_ascii=False).replace('"', "'")) for k in keys) + ' }'


def write_listing_suburbs(dataset):
    """Reads the Kaggle rentals download and writes tools/listing-suburbs.csv: every Queensland suburb that has
    a listing (name, postcode, average listing position), so those suburbs get scores too."""
    if dataset.suffix.lower() == '.json':
        data = json.load(open(dataset, encoding='utf-8'))
        rows = data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list))
    else:
        rows = list(csv.DictReader(open(dataset, encoding='utf-8-sig')))
    places = {}
    for r in rows:
        if str(r.get('state') or '').strip().lower() != 'qld':
            continue
        name, pc = str(r.get('suburb') or '').strip(), str(r.get('postcode') or '').strip()
        try:
            lat, lng = float(r['latitude']), float(r['longitude'])
        except (TypeError, ValueError, KeyError):
            continue
        if name and pc:
            places.setdefault((name, pc), []).append((lat, lng))
    with open(LISTING_SUBURBS, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(['suburb', 'postcode', 'lat', 'lng', 'listings'])
        for (name, pc), pts in sorted(places.items()):
            w.writerow([name, pc, round(sum(p[0] for p in pts) / len(pts), 5), round(sum(p[1] for p in pts) / len(pts), 5), len(pts)])
    print('Wrote', len(places), 'Queensland listing suburbs to', LISTING_SUBURBS.relative_to(ROOT))


def main():
    features, all_features = {}, {}
    for f in json.load(open(source('boundaries.geojson'), encoding='utf-8'))['features']:
        name = f['properties']['qld_loca_2']
        s = shape(f)
        all_features.setdefault(name, []).append(s)
        # Some names exist twice in Queensland (e.g. West End in Townsville): for Brisbane keep the one nearest the CBD.
        if name not in features or km(s['centre'], CBD) < km(features[name]['centre'], CBD):
            features[name] = s

    postcodes = {}
    with open(source('postcodes.csv'), encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            if r['state'] == 'QLD' and r['type'] == 'Delivery Area':
                try:
                    d = km((float(r['lat']), float(r['long'])), CBD)
                except ValueError:
                    continue
                if d < 50:
                    postcodes.setdefault(r['locality'], r['postcode'])

    # Translink stops
    stations, ferries, buses = [], {}, []
    with open(STOPS, encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            lat, lng = float(r['stop_lat']), float(r['stop_lon'])
            name = r['stop_name'].strip()
            if re.match(r'^place_.*sta$', r['stop_id']):
                stations.append((name, (lat, lng)))
            elif re.search(r'ferry terminal', name, re.I):
                ferries.setdefault(re.sub(r'\s*(stop|platform|berth).*$', '', name, flags=re.I), (lat, lng))
            elif r['location_type'].strip() in ('', '0') and not r['parent_station'].strip().endswith('sta'):
                buses.append((lat, lng))

    # Which places to score: every Brisbane City Council suburb, plus every other Queensland suburb with a rental listing.
    # Each place: name, postcode, boundary, and whether it is a BCC suburb (only those have Council park data).
    places, missing = [], []
    for name in BCC_SUBURBS:
        f, pc = features.get(name.upper()), postcodes.get(name.upper())
        if f and pc:
            places.append({'name': name, 'postcode': pc, 'shape': f, 'bcc': True})
        else:
            missing.append(name)
    bcc = {(p['name'].upper(), p['postcode']) for p in places}
    if LISTING_SUBURBS.exists():
        with open(LISTING_SUBURBS, encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                if (r['suburb'].upper(), r['postcode']) in bcc:
                    continue
                at = (float(r['lat']), float(r['lng']))
                options = all_features.get(r['suburb'].upper())
                if not options:
                    # A locality newer than the 2017 boundaries (e.g. Banya, Kirra): borrow the boundary the listings sit in
                    options = [o for opts in all_features.values() for o in opts if in_polys(at[0], at[1], o['polys'])]
                if not options:
                    missing.append(r['suburb'] + ' ' + r['postcode'])
                    continue
                # The locality the listings are in (or nearest to), so Townsville's West End isn't Brisbane's
                f = next((o for o in options if in_polys(at[0], at[1], o['polys'])), None) or min(options, key=lambda o: km(o['centre'], at))
                places.append({'name': r['suburb'], 'postcode': r['postcode'], 'shape': f, 'bcc': False})
    # A name used by more than one scored place gets its postcode in the slug (west-end-4810), like tools/convert-rentals.py
    name_count = {}
    for p in places:
        name_count[p['name'].lower()] = name_count.get(p['name'].lower(), 0) + 1
    for p in places:
        p['slug'] = slugify(p['name']) if p['bcc'] or name_count[p['name'].lower()] == 1 else slugify(p['name'] + ' ' + p['postcode'])

    # QPS: which division each suburb centre is in, and that division's last 12 months of offence rates
    divisions = police_divisions()
    for p in places:
        c = p['shape']['centre']
        p['division'] = next((d for d, polys in divisions.items() if in_polys(c[0], c[1], polys)), None)
    wanted = {p['division'] for p in places if p['division']}
    rate = {}
    with open(source('qps-rates.csv'), encoding='utf-8-sig') as fh:
        rows = [r for r in csv.DictReader(fh) if r['Division'].upper() in wanted]
    order = sorted({r['Month Year'] for r in rows}, key=lambda m: (int(m[3:]), ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].index(m[:3])))
    months = order[-12:]
    nice = lambda m: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
                      'October', 'November', 'December'][['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].index(m[:3])] + ' 20' + m[3:]
    for r in rows:
        if r['Month Year'] in months:
            d = r['Division'].upper()
            rate[d] = rate.get(d, 0) + sum(float(r[c] or 0) for c in SAFETY_COLUMNS)

    census_of = census()
    all_stops = buses + [p for _, p in stations] + list(ferries.values())
    suburbs = []
    for pl in places:
        f, name = pl['shape'], pl['name']
        c = f['centre']
        lat_lo, lat_hi, lng_lo, lng_hi = f['bbox']
        inside = lambda p: lat_lo <= p[0] <= lat_hi and lng_lo <= p[1] <= lng_hi and in_polys(p[0], p[1], f['polys'])
        near = lambda p: inside(p) or km(p, c) <= NEAR_KM
        bus = sum(1 for p in buses if inside(p))
        # Translink's GTFS only covers South East Queensland: further away there is no stop data at all, so no transport score
        covered = any(abs(p[0] - c[0]) < .1 and abs(p[1] - c[1]) < .1 and km(p, c) <= TRANSLINK_KM for p in all_stops)
        division = pl['division']
        suburbs.append({
            'slug': pl['slug'], 'name': name, 'postcode': pl['postcode'], 'bcc': pl['bcc'],
            'lat': round(c[0], 4), 'lng': round(c[1], 4), 'area': round(f['area'], 2),
            'covered': covered, 'bus': bus, 'density': bus / f['area'] if f['area'] else 0,
            'trains': sorted({n for n, p in stations if near(p)}),
            'ferries': sorted({n for n, p in ferries.items() if near(p)}),
            'division': division.title() if division else None, 'crimeRate': round(rate[division]) if division in rate else None,
            'census': census_of(name) if pl['bcc'] else census_of(name, f['area']),
        })
    if missing:
        print('No boundary or postcode for:', ', '.join(missing))

    served = [s for s in suburbs if s['covered']]
    for s, base in zip(served, rank_scores([s['density'] for s in served])):
        s['transport'] = min(10, base + (2 if s['trains'] else 0) + (1 if s['ferries'] else 0))
    policed = [s for s in suburbs if s['crimeRate'] is not None]
    for s, score in zip(policed, rank_scores([s['crimeRate'] for s in policed], higher_is_better=False)):
        s['safety'] = score
    no_census = [s['name'] for s in suburbs if not s['census']]
    if no_census:
        print('No 2021 Census match for:', ', '.join(no_census))
    rented = [s for s in suburbs if s['census'] and s['census']['rent']]
    for s, score in zip(rented, rank_scores([s['census']['rent'] for s in rented], higher_is_better=False)):
        s['afford'] = score

    lines = []
    for s in suburbs:
        q = lambda v: json.dumps(v).replace('"', "'")
        lines.append(
            "  { slug: %s, name: %s, postcode: '%s', bcc: %s, lat: %.4f, lng: %.4f, areaKm2: %s,\n"
            "    transport: %s, busStops: %s, trains: %s, ferries: %s,\n"
            "    safety: %s, policeDivision: %s, crimeRate: %s,\n"
            "    afford: %s, census: %s }" % (
                q(s['slug']), q(s['name']), s['postcode'], json.dumps(s['bcc']),
                s['lat'], s['lng'], s['area'], json.dumps(s.get('transport')), json.dumps(s['bus'] if s['covered'] else None),
                json.dumps(s['trains']), json.dumps(s['ferries']),
                json.dumps(s.get('safety')), q(s['division']), json.dumps(s['crimeRate']),
                json.dumps(s.get('afford')), census_js(s['census'])))
    header = (
        '/* ==========================================================================\n'
        '   SUBURB LIST — generated by tools/build-suburbs.py, do not edit by hand.\n'
        '   %d suburbs: every Brisbane City Council suburb (bcc: true), plus every other Queensland suburb that has a\n'
        '   rental listing (from tools/listing-suburbs.csv). Scores rank all of them together, and a score is null\n'
        '   (shown as "No data") where a source doesn\'t cover the suburb:\n'
        '     lat/lng    centre of the suburb boundary (Queensland localities)\n'
        '     transport  1–10 rank: Translink bus stops per km², +2 train station, +1 ferry terminal\n'
        '                (in the suburb or within %g km of its centre); null outside the South East Queensland network\n'
        '     safety     1–10 rank: QPS reported offences against the person + property per 100,000\n'
        '                people, %s to %s, for the police division the suburb is in (crimeRate)\n'
        '     afford     1–10 rank: ABS 2021 Census median weekly rent (cheapest = 10), null if none recorded\n'
        '     census     ABS 2021 Census figures (G01, G02): population, medianAge, topAgeGroup, bornOverseas (%%),\n'
        '                householdSize, householdIncome ($/week), rent ($/week), mortgage ($/month)\n'
        '   Parks are worked out in the browser (js/app.js) from Brisbane City Council data, so only bcc suburbs have them.\n'
        '   ========================================================================== */\n'
        'window.SM = window.SM || {};\n'
        "SM.SAFETY_PERIOD = '%s to %s';\n"
        'SM.SUBURBS = [\n' % (len(suburbs), NEAR_KM, nice(months[0]), nice(months[-1]), nice(months[0]), nice(months[-1])))
    OUT.write_text(header + ',\n'.join(lines) + '\n];\n', encoding='utf-8')
    print('Wrote', len(suburbs), 'suburbs to', OUT.relative_to(ROOT), '| QPS months', months[0], '-', months[-1])


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        write_listing_suburbs(Path(sys.argv[1]))
    main()
