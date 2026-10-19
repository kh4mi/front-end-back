/* listing.js — one rental listing. Reads the listing from the URL: listing.html?id=k0001 */
(async function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  const id = new URLSearchParams(window.location.search).get('id');
  const data = await SM.init();
  const l = SM.RENTALS.find((r) => r.id === id);

  if (!l) {
    $('#listingTitle').textContent = 'Listing not found';
    $('#price').textContent = '';
    $('#address').innerHTML = 'This listing isn\'t in our dataset. <a href="rentals.html">Browse rentals</a>.';
    document.querySelector('.listing-layout aside').hidden = true;
    $('#crumbSuburb').hidden = true;
    $('#crumbSuburb').previousSibling.textContent = '';
    return;
  }

  const s = data.bySlug[l.slug]; // undefined for suburbs we don't score
  const address = l.street + ', ' + l.suburb + ' ' + (l.state || 'QLD') + ' ' + l.postcode;
  const details = (SM.RENTAL_DETAILS || {})[l.id] || {};

  document.title = l.street + ', ' + l.suburb + ' – Suburb.ly';
  $('#crumbSuburb').textContent = 'Rentals in ' + l.suburb;
  $('#crumbSuburb').href = 'rentals.html?suburb=' + encodeURIComponent(l.slug);

  // Photo: Street View of the address, with the grey placeholder underneath if there's no imagery
  const photoURL = SM.streetViewURL(l, '640x300');
  if (photoURL) {
    const img = document.createElement('img');
    img.src = photoURL;
    img.alt = 'Street view near ' + address;
    img.onerror = () => img.remove();
    $('#photo').appendChild(img);
  }

  $('#price').innerHTML = SM.formatPrice(l.price) + '<span>/wk</span>';
  $('#type').textContent = l.type;
  $('#listingTitle').textContent = l.title || address;
  $('#address').textContent = address;
  $('#facts').innerHTML =
    '<li>' + SM.icon('bed') + l.beds + (l.beds === 1 ? ' bedroom' : ' bedrooms') + '</li>' +
    '<li>' + SM.icon('shower') + l.baths + (l.baths === 1 ? ' bathroom' : ' bathrooms') + '</li>' +
    '<li>' + SM.icon('car') + l.cars + (l.cars === 1 ? ' car space' : ' car spaces') + '</li>';

  // Description: the agent's text, split into paragraphs; lines starting with "-" become a list
  const desc = (details.description || '').trim();
  $('#description').innerHTML = desc
    ? desc.split(/\n{2,}/).map(function (block) {
        const lines = block.split('\n').map((t) => t.trim()).filter(Boolean);
        const bullets = lines.filter((t) => /^[-•*]\s*/.test(t));
        if (bullets.length && bullets.length === lines.length) {
          return '<ul>' + lines.map((t) => '<li>' + SM.esc(t.replace(/^[-•*]\s*/, '')) + '</li>').join('') + '</ul>';
        }
        return '<p>' + lines.map(SM.esc).join('<br>') + '</p>';
      }).join('')
    : '<p class="muted">The listing has no description.</p>';
  if (details.amenities) {
    $('#amenities').hidden = false;
    $('#amenities').innerHTML = '<strong>Features:</strong> ' + SM.esc(details.amenities.replace(/;\s*/g, ', '));
  }
  $('#agency').textContent = l.agency ? 'Listed by ' + l.agency : '';

  // Save button (the same saved list as the stars on the rentals page)
  const saveBtn = $('#saveBtn');
  function paintSave() {
    const saved = SM.getSaved('Listings').indexOf(l.id) >= 0;
    saveBtn.setAttribute('aria-pressed', String(saved));
    saveBtn.innerHTML = SM.icon('star') + (saved ? ' Saved' : ' Save listing');
  }
  saveBtn.addEventListener('click', function () { SM.toggleSaved('Listings', l.id); paintSave(); });
  paintSave();

  // Suburb panel: fit and scores, or a note for suburbs outside Brisbane City
  if (s) {
    $('#suburbLink').href = 'suburbSummary.html?s=' + encodeURIComponent(s.slug);
    $('#suburbLink').innerHTML = 'About ' + SM.esc(s.name) + ' <span aria-hidden="true">→</span>';
    $('#fitHeading').textContent = s.name + ': ' + s.fit + '% fit';
    $('#fitText').textContent = data.prefs
      ? 'How well ' + s.name + ' matches the priorities from your quiz.'
      : 'Based on equal weights. Take the quiz to match suburbs to what matters to you.';
    $('#bars').innerHTML = SM.FACTORS.map(function (f) {
      const v = s.scores[f.key];
      return (
        '<div class="bar' + (v === null ? ' bar--none' : '') + '" data-factor="' + f.key + '">' +
          '<span class="bar__label">' + SM.esc(f.short) + '</span>' +
          '<span class="bar__track" aria-hidden="true"><span class="bar__fill" style="--score:' + (v || 0) + '"></span></span>' +
          '<span class="bar__num">' + SM.scoreText(v) + '</span>' +
        '</div>'
      );
    }).join('');
  } else {
    $('#suburbLink').hidden = true;
    $('#fitHeading').textContent = l.suburb;
    $('#fitText').textContent = 'We don\'t have scores for this suburb yet, so it has no fit score.';
  }

  // Rent compared with the suburb's asking rents and the census median
  const rent = SM.rentStats(l.slug);
  const rows = [];
  if (rent.count > 1) {
    const diff = l.price - rent.median;
    rows.push(['Median asking rent in ' + l.suburb, SM.formatPrice(rent.median) + ' per week (' + rent.count + ' listings)']);
    rows.push(['This listing', diff === 0 ? 'Right on the median'
      : SM.formatPrice(Math.abs(diff)) + (diff > 0 ? ' above' : ' below') + ' the median']);
  } else {
    rows.push(['Median asking rent in ' + l.suburb, 'This is the only listing in the dataset']);
  }
  if (s && s.census && s.census.rent) rows.push(['Median rent, 2021 Census', SM.formatPrice(s.census.rent) + ' per week']);
  if (data.prefs && data.prefs.budget && data.prefs.budget.max) {
    const ok = l.price <= data.prefs.budget.max && (data.prefs.budget.min === null || l.price >= data.prefs.budget.min);
    rows.push(['Your budget', ok ? 'Within your budget' : 'Outside your budget']);
  }
  $('#rentCompare').innerHTML = rows.map((r) => '<dt>' + SM.esc(r[0]) + '</dt><dd>' + SM.esc(r[1]) + '</dd>').join('');

  // Map with one red pin, the same pin as the suburb page
  if (window.L && typeof l.lat === 'number') {
    const map = L.map('listingMap', { scrollWheelZoom: false }).setView([l.lat, l.lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    const pin = L.divIcon({
      className: 'rental-pin',
      html: '<svg viewBox="0 0 24 34" aria-hidden="true" focusable="false"><path d="M12 33S2 19.5 2 12a10 10 0 0 1 20 0c0 7.5-10 21-10 21z"/><circle cx="12" cy="12" r="4"/></svg>',
      iconSize: [26, 36], iconAnchor: [13, 35]
    });
    L.marker([l.lat, l.lng], { icon: pin, title: address }).addTo(map);
  }

  // More rentals: the same suburb first, then the nearest others
  const others = SM.RENTALS.filter((r) => r.id !== l.id)
    .map((r) => ({ r: r, d: r.slug === l.slug ? -1 : SM.km(l, r) }))
    .sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.r);
  if (others.length) {
    const saved = SM.getSaved('Listings');
    $('#moreSection').hidden = false;
    $('#more').innerHTML = others.map((r) => SM.listingCardHTML(r, data.bySlug[r.slug], saved.indexOf(r.id) >= 0)).join('');
    SM.bindSaveButtons($('#more'));
  }

  loadNearby(l, data.parkInfo);
})();

/* ------------------------------------------------------------------
   Nearby: the closest bus stop, train station, ferry terminal, park, shopping centre, supermarket, school and hospital.
   Stops come from Translink's GTFS file (data/stops.txt), parks from the Council data already loaded
   for the scores, and shops, schools and hospitals from Google Places (cached in the browser for a week per listing).
   ------------------------------------------------------------------ */
const NEARBY_ROWS = [
  { key: 'bus',   label: 'Bus stop' },
  { key: 'train', label: 'Train station' },
  { key: 'ferry', label: 'Ferry terminal' },
  { key: 'mall',  label: 'Shopping centre', types: ['shopping_mall'], radius: 5000 },
  { key: 'shop',  label: 'Supermarket',     types: ['supermarket'],   radius: 3000 },
  { key: 'school', label: 'School',         types: ['primary_school', 'secondary_school'], radius: 3000 },
  { key: 'hospital', label: 'Hospital',     types: ['hospital'],      radius: 5000 },
  { key: 'park',  label: 'Park' }
];
const NEARBY_MAX_KM = 5; // anything further away shows as "None within 5 km"

function nearestOf(from, points) {
  let best = null;
  points.forEach(function (p) {
    const km = SM.km(from, p);
    if (km <= NEARBY_MAX_KM && (!best || km < best.km)) best = { name: p.name, km: km };
  });
  return best;
}

// Splits one CSV line, keeping commas inside "quoted" names
function csvRow(line) {
  return (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
}

async function nearestStops(l) {
  const text = await (await fetch('data/stops.txt')).text();
  const lines = text.split(/\r?\n/);
  const head = csvRow(lines[0]);
  const col = (name) => head.indexOf(name);
  const iId = col('stop_id'), iName = col('stop_name'), iLat = col('stop_lat'), iLng = col('stop_lon'), iType = col('location_type'), iParent = col('parent_station');
  const bus = [], train = [], ferry = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const r = csvRow(lines[i]);
    const p = { name: r[iName], lat: parseFloat(r[iLat]), lng: parseFloat(r[iLng]) };
    if (isNaN(p.lat) || isNaN(p.lng)) continue;
    // Same rules as the suburb page: stations have ids like place_tarsta, ferry terminals are named so
    if (/^place_.*sta$/.test(r[iId])) train.push(p);
    else if (/ferry terminal/i.test(p.name)) { if (r[iType] === '1' || !r[iParent]) ferry.push(p); }
    else if (r[iType] !== '1' && !/sta$/.test(r[iParent] || '')) bus.push(p);
  }
  return { bus: nearestOf(l, bus), train: nearestOf(l, train), ferry: nearestOf(l, ferry) };
}

async function nearestPlace(l, row) {
  if (!SM.GOOGLE_MAPS_KEY) return undefined;
  const cacheKey = 'places.v1.listing.' + l.id + '.' + row.types.join('+');
  const cached = SM.store.get(cacheKey, null);
  if (cached && Date.now() - cached.at < 7 * 864e5) return cached.place;
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': SM.GOOGLE_MAPS_KEY, 'X-Goog-FieldMask': 'places.displayName,places.location' },
    body: JSON.stringify({
      includedPrimaryTypes: row.types,
      maxResultCount: 5,
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: l.lat, longitude: l.lng }, radius: row.radius } }
    })
  });
  if (!res.ok) throw new Error('Places HTTP ' + res.status);
  const json = await res.json();
  const place = nearestOf(l, (json.places || []).map((p) => ({ name: p.displayName.text, lat: p.location.latitude, lng: p.location.longitude })));
  SM.store.set(cacheKey, { at: Date.now(), place: place });
  return place;
}

async function loadNearby(l, parkInfo) {
  const found = {};
  const tidy = (n) => n.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()); // Council park names are all caps
  const parks = parkInfo && parkInfo.ok
    ? Object.values(parkInfo.bySuburb).reduce((all, b) => all.concat(b.points || []), []).map((p) => ({ name: tidy(p.name), lat: p.lat, lng: p.lng }))
    : null;
  found.park = parks ? nearestOf(l, parks) : undefined;

  const jobs = [nearestStops(l).then((s) => Object.assign(found, s)).catch(() => {})];
  NEARBY_ROWS.filter((r) => r.types).forEach(function (row) {
    jobs.push(nearestPlace(l, row).then((p) => { found[row.key] = p; }).catch(() => { found[row.key] = undefined; }));
  });
  await Promise.all(jobs);

  document.getElementById('nearby').innerHTML = NEARBY_ROWS.map(function (row) {
    const p = found[row.key];
    let value;
    if (p === undefined) value = '<span class="muted">Not available</span>';
    else if (p === null) value = '<span class="muted">None within ' + NEARBY_MAX_KM + ' km</span>';
    else {
      const walk = p.km <= 2 ? ' · ' + Math.max(1, Math.round(p.km / 5 * 60)) + ' min walk' : '';
      value = '<span class="listing-nearby__name">' + SM.esc(p.name) + '</span>' +
        '<span class="nearby__dist">' + p.km.toFixed(1) + ' km' + walk + '</span>';
    }
    return '<li><strong>' + row.label + '</strong><span class="listing-nearby__value">' + value + '</span></li>';
  }).join('');
}
