/* ==========================================================================
   app.js — logic shared by every page
   Load AFTER data/suburbs.js and data/rentals.js.

   Sections:
     1. Factors, destinations, icons, small helpers
     2. Saved data (localStorage) and quiz answers
     3. Live data: Brisbane City Council parks API
     4. Matching: scores and "% fit"
     5. Listing card HTML
   ========================================================================== */
(function () {
  'use strict';
  const SM = (window.SM = window.SM || {});

  /* ------------------------------------------------------------------
     1. Factors, destinations, icons, helpers
     ------------------------------------------------------------------ */
  SM.FACTORS = [
    { key: 'afford',    label: 'Affordability',      short: 'Affordability' },
    { key: 'transport', label: 'Transport',          short: 'Transport' },
    { key: 'safety',    label: 'Safety',             short: 'Safety' },
    { key: 'parks',     label: 'Parks & Recreation', short: 'Parks & Rec' }
  ];
  SM.factor = (key) => SM.FACTORS.find((f) => f.key === key);

  SM.CBD = { lat: -27.4698, lng: 153.0251 };
  SM.DESTINATIONS = {
    uq:    { label: 'UQ St Lucia',       lat: -27.4975, lng: 153.0137 },
    qut:   { label: 'QUT Gardens Point', lat: -27.4770, lng: 153.0290 },
    cbd:   { label: 'Brisbane CBD',      lat: SM.CBD.lat, lng: SM.CBD.lng },
    other: { label: null }
  };

  // Simple line icons (drawn for this project, 24x24, use currentColor).
  const ICONS = {
    bed:    '<path d="M3 5v14M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="1.6"/>',
    shower: '<path d="M4 20V8a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4"/><path d="M9 11h10l-1 3H10z"/><path d="M11 17v2M14 17v2M17 17v2"/>',
    car:    '<path d="M3 16v-4l2-5h12l3 5v4z"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
    smile:  '<circle cx="12" cy="12" r="9"/><path d="M8 14.2c1 1.5 2.3 2.1 4 2.1s3-.6 4-2.1"/><path d="M9 9.6v.01M15 9.6v.01"/>',
    pin:    '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    left:   '<path d="M15 5l-7 7 7 7"/>',
    right:  '<path d="M9 5l7 7-7 7"/>',
    arrow:  '<path d="M5 12h14M13 6l6 6-6 6"/>',
    star:   '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>'
  };
  SM.icon = (name, extraClass) =>
    '<svg class="icon icon-' + name + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';

  // Escape text before putting it into HTML strings.
  SM.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Straight-line distance in km between two {lat, lng} points (haversine formula).
  SM.km = function (a, b) {
    const R = 6371;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // A 1–10 score as text, or "No data" when a suburb has none
  SM.scoreText = (v) => (v === null || v === undefined ? 'No data' : v + '/10');

  // 1–5 importance rating -> word used in filter chips
  SM.level = (rating) => (rating >= 4 ? 'High' : rating === 3 ? 'Medium' : 'Low');

  /* ------------------------------------------------------------------
     2. Saved data (localStorage) and quiz answers
        Everything stays in the visitor's own browser. Nothing is sent anywhere.
        When someone is logged in (demo accounts, see js/signup.js), their quiz answers
        and saved items are kept under their own account: sm.user.<email>.<key>
     ------------------------------------------------------------------ */
  function storePrefix() {
    try {
      const session = JSON.parse(window.localStorage.getItem('sm.session') || 'null');
      return session && session.email ? 'sm.user.' + session.email + '.' : 'sm.';
    } catch (e) { return 'sm.'; }
  }
  SM.store = {
    get(key, fallback) {
      try {
        const v = window.localStorage.getItem(storePrefix() + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { window.localStorage.setItem(storePrefix() + key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) {
      try { window.localStorage.removeItem(storePrefix() + key); } catch (e) { /* ignore */ }
    }
  };

  SM.DEFAULT_PREFS = {
    order: SM.FACTORS.map((f) => f.key),
    weights: { afford: 3, transport: 3, safety: 3, parks: 3 },
    budget: { min: null, max: null },
    beds: 1,
    destination: 'other'
  };
  // Returns the visitor's saved quiz answers, or null if they haven't done the quiz.
  SM.getPrefs = function () {
    const saved = SM.store.get('prefs', null);
    if (!saved) return null;
    return Object.assign({}, SM.DEFAULT_PREFS, saved, {
      weights: Object.assign({}, SM.DEFAULT_PREFS.weights, saved.weights),
      budget: Object.assign({}, SM.DEFAULT_PREFS.budget, saved.budget)
    });
  };

  SM.getSaved = (kind) => SM.store.get('saved' + kind, []); // kind: 'Suburbs' | 'Listings'
  SM.toggleSaved = function (kind, id) {
    const list = SM.getSaved(kind);
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    SM.store.set('saved' + kind, list);
    return i < 0; // true = now saved
  };

  /* ------------------------------------------------------------------
     3. Live data: Brisbane City Council parks API
        Dataset: "Park - Locations"
        https://data.brisbane.qld.gov.au/explore/dataset/park-locations/api/
        API: Opendatasoft Explore API v2.1 (the platform Brisbane City Council uses)
        https://data.brisbane.qld.gov.au/api-console/explore/v2.1/

        How it works:
          a) fetch 1 record to discover the dataset's real field names
          b) download every park (only name / suburb / location fields)
          c) count parks per suburb (by suburb name, or within 1.5 km if there is no suburb field)
          d) turn counts into a 1–10 score (see SM.buildSuburbs)
     ------------------------------------------------------------------ */
  const PARKS_BASE = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/park-locations';
  const PARKS_CACHE_KEY = 'sm.parks.v3'; // v3: also keeps each park's location (for the suburb map)
  const RADIUS_KM = 1.5;

  async function getJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); // give up after 20 s
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function readPoint(v) {
    if (!v || typeof v !== 'object') return null;
    const lat = v.lat !== undefined ? v.lat : v.latitude;
    const lng = v.lon !== undefined ? v.lon : (v.lng !== undefined ? v.lng : v.longitude);
    return typeof lat === 'number' && typeof lng === 'number' ? { lat: lat, lng: lng } : null;
  }

  function detectFields(sample) {
    const keys = Object.keys(sample);
    return {
      suburb: keys.find((k) => /suburb|locality/i.test(k)) || null,
      name:   keys.find((k) => /^(park_?)?name$/i.test(k)) || keys.find((k) => /name/i.test(k)) || null,
      geo:    keys.find((k) => readPoint(sample[k])) || null
    };
  }

  async function fetchAllParks(fields) {
    const select = [fields.name, fields.suburb, fields.geo].filter(Boolean).join(',');
    const selectQs = select ? 'select=' + encodeURIComponent(select) : '';
    try {
      // One request that returns every record.
      const all = await getJson(PARKS_BASE + '/exports/json' + (selectQs ? '?' + selectQs : ''));
      if (Array.isArray(all) && all.length) return all;
    } catch (e) {
      console.warn('[SM] Bulk export failed, paging through records instead:', e);
    }
    // Fallback: page through /records 100 at a time.
    const rows = [];
    for (let offset = 0; offset < 3000; offset += 100) {
      const page = await getJson(PARKS_BASE + '/records?limit=100&offset=' + offset + (selectQs ? '&' + selectQs : ''));
      const batch = page.results || [];
      rows.push.apply(rows, batch);
      if (batch.length < 100) break;
    }
    return rows;
  }

  function summariseParks(rows, fields) {
    const bySuburb = {};
    SM.SUBURBS.forEach((s) => { bySuburb[s.slug] = { count: 0, names: [], points: [] }; });
    const add = (slug, row) => {
      bySuburb[slug].count += 1;
      const nm = fields.name ? row[fields.name] : null;
      if (nm) bySuburb[slug].names.push(String(nm));
      const pt = fields.geo ? readPoint(row[fields.geo]) : null;
      if (pt) bySuburb[slug].points.push({ name: nm ? String(nm) : 'Park', lat: +pt.lat.toFixed(5), lng: +pt.lng.toFixed(5) });
    };

    let method = 'suburb-field';
    let matched = 0;
    if (fields.suburb) {
      const slugByName = new Map(SM.SUBURBS.map((s) => [s.name.toLowerCase(), s.slug]));
      rows.forEach((row) => {
        const slug = slugByName.get(String(row[fields.suburb] || '').trim().toLowerCase());
        if (slug) { matched += 1; add(slug, row); }
      });
    }
    if (!matched && fields.geo) {
      method = 'radius';
      rows.forEach((row) => {
        const p = readPoint(row[fields.geo]);
        if (!p) return;
        SM.SUBURBS.forEach((s) => { if (SM.km(p, s) <= RADIUS_KM) add(s.slug, row); });
      });
    }
    const totalCounted = Object.values(bySuburb).reduce((sum, b) => sum + b.count, 0);
    return { ok: totalCounted > 0, method: method, fields: fields, total: rows.length, bySuburb: bySuburb, fetchedAt: Date.now() };
  }

  // Loads park data once per page load (and caches it in sessionStorage for the tab).
  SM.loadParks = function () {
    if (SM._parksPromise) return SM._parksPromise;
    SM._parksPromise = (async function () {
      try {
        try {
          const cached = JSON.parse(window.sessionStorage.getItem(PARKS_CACHE_KEY) || 'null');
          if (cached && cached.ok) return cached;
        } catch (e) { /* no cache available */ }

        const first = await getJson(PARKS_BASE + '/records?limit=1');
        const sample = first.results && first.results[0];
        if (!sample) throw new Error('The parks dataset returned no records.');
        const fields = detectFields(sample);
        console.info('[SM] Parks dataset fields detected:', fields, '(all fields:', Object.keys(sample), ')');

        const rows = await fetchAllParks(fields);
        const info = summariseParks(rows, fields);
        if (!info.ok) throw new Error('Could not match any parks to the suburbs in our list.');
        console.info('[SM] Parks loaded:', info.total, 'records, counted by', info.method);
        try { window.sessionStorage.setItem(PARKS_CACHE_KEY, JSON.stringify(info)); } catch (e) { /* too big or blocked */ }
        return info;
      } catch (err) {
        console.warn('[SM] Live parks data unavailable, so parks are left out of the match.', err);
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    })();
    return SM._parksPromise;
  };

  /* ------------------------------------------------------------------
     4. Matching
     ------------------------------------------------------------------ */
  /* Builds the suburb list with 1–10 scores. Pass parkInfo from SM.loadParks(), or null to skip live parks.
     transport and safety come ready-made from data/suburbs.js (tools/build-suburbs.py).
     A score is null when that suburb has no data (e.g. no rental listings).
     SM.available says which factors have data at all, e.g. parks is false if the Council API is down. */
  SM.buildSuburbs = function (parkInfo) {
    const list = SM.SUBURBS.map((s) => Object.assign({}, s, {
      scores: { afford: null, transport: s.transport, safety: s.safety, parks: null },
      parkCount: null,
      parkNames: [],
      parkPoints: [],
      parksLive: false,
      kmCbd: SM.km(s, SM.CBD)
    }));

    if (parkInfo && parkInfo.ok) {
      // Parks score = where the suburb ranks for number of parks, mapped onto 1–10.
      const park = (s) => parkInfo.bySuburb[s.slug] || { count: 0, names: [], points: [] };
      const counts = list.map((s) => park(s).count);
      list.forEach((s, i) => {
        const fewer = counts.filter((c) => c < counts[i]).length;
        s.scores.parks = Math.max(1, Math.min(10, 1 + Math.round((9 * fewer) / (list.length - 1))));
        s.parkCount = counts[i];
        s.parkNames = park(s).names;
        s.parkPoints = park(s).points || [];
        s.parksLive = true;
      });
    }

    // Affordability score comes ready-made from data/suburbs.js: where the suburb's ABS 2021 Census median weekly rent
    // ranks (cheapest = 10). The listings' median asking rent (data/rentals.js) is kept for the suburb page.
    list.forEach((s) => {
      s.scores.afford = typeof s.afford === 'number' ? s.afford : null;
      s.affordLive = s.scores.afford !== null;
      if (Array.isArray(SM.RENTALS)) s.medianRent = SM.rentStats(s.slug).median;
    });
    SM.available = {};
    SM.FACTORS.forEach((f) => { SM.available[f.key] = list.some((s) => s.scores[f.key] !== null); });
    return list;
  };

  /* How a quiz rating (1 = doesn't matter … 5 = very important) turns into a weight.
     The steps grow fast on purpose: with gentle weights, a suburb that is decent at
     everything (e.g. Toowong) wins no matter what you pick. 1 means "ignore this factor". */
  SM.RATING_WEIGHT = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 7 };
  // Ranking breaks ties between equal ratings: 1st place counts 30% more than 4th.
  SM.RANK_BONUS = 0.1;
  // Weight for the extra parts that only exist when you answered the budget, bedrooms or destination questions.
  SM.EXTRA_WEIGHT = 4; // the same as rating something 4 ("important")
  SM.COMMUTE_ZERO_KM = 15; // this far (straight line) or more from your destination scores 1/10

  SM.NO_DATA_SCORE = 5; // a suburb missing one score is counted as average for it, not best or worst

  SM.weightsFor = function (prefs) {
    const w = {};
    const usable = (k) => !SM.available || SM.available[k] !== false; // factors with no data anywhere are left out
    if (!prefs) { SM.FACTORS.forEach((f) => { w[f.key] = usable(f.key) ? 1 : 0; }); return w; } // no quiz yet: equal weights
    const n = prefs.order.length;
    prefs.order.forEach((key, i) => {
      const rating = prefs.weights[key] || 3;
      w[key] = usable(key) ? (SM.RATING_WEIGHT[rating] !== undefined ? SM.RATING_WEIGHT[rating] : 2) * (1 + (n - 1 - i) * SM.RANK_BONUS) : 0;
    });
    // Everything rated 1: fall back to equal weights so every suburb isn't 0%
    if (!Object.keys(w).some((k) => w[k] > 0)) SM.FACTORS.forEach((f) => { w[f.key] = usable(f.key) ? 1 : 0; });
    return w;
  };

  // The parts that make up a suburb's fit for these quiz answers: the four factors, plus
  // "rentals that fit you" (budget + bedrooms) and "distance to your destination" when answered.
  // Each part has a 1–10 score and a weight; fit = weighted average, as a %.
  SM.fitParts = function (s, prefs) {
    const w = SM.weightsFor(prefs);
    const keys = prefs ? prefs.order : SM.FACTORS.map((f) => f.key);
    const parts = keys.map((k) => (s.scores[k] === null
      ? { key: k, label: SM.factor(k).label, score: SM.NO_DATA_SCORE, weight: w[k], note: 'no data, counted as average' }
      : { key: k, label: SM.factor(k).label, score: s.scores[k], weight: w[k] }));
    if (!prefs) return parts;

    // Budget and bedrooms: share of this suburb's listings you could actually rent
    const hasBudget = prefs.budget && prefs.budget.max !== null;
    if ((hasBudget || prefs.beds > 1) && Array.isArray(SM.RENTALS)) {
      const here = SM.RENTALS.filter((l) => l.slug === s.slug);
      if (here.length) { // no listings: leave it out rather than guess
        const ok = here.filter((l) => (!hasBudget || l.price <= prefs.budget.max) && l.beds >= (prefs.beds || 1)).length;
        parts.push({
          key: 'rentfit', label: 'Rentals in your budget', weight: SM.EXTRA_WEIGHT,
          score: Math.round(1 + 9 * (ok / here.length)),
          note: ok + ' of ' + here.length + ' listings'
        });
      }
    }
    // Destination: straight-line distance to where you'll spend most of your time
    const dest = SM.DESTINATIONS[prefs.destination];
    if (dest && dest.label) {
      const km = SM.km(s, dest);
      parts.push({
        key: 'commute', label: 'Close to ' + dest.label, weight: SM.EXTRA_WEIGHT,
        score: Math.max(1, Math.min(10, Math.round(10 - (9 * km) / SM.COMMUTE_ZERO_KM))),
        note: km.toFixed(1) + ' km'
      });
    }
    return parts;
  };

  // Adds `fit` (0–100) and `parts` to each suburb and returns a copy sorted best-first.
  SM.applyFit = function (list, prefs) {
    list.forEach((s) => {
      s.parts = SM.fitParts(s, prefs);
      const total = s.parts.reduce((sum, p) => sum + p.weight, 0);
      const weighted = s.parts.reduce((sum, p) => sum + p.weight * p.score, 0);
      s.fit = total ? Math.round((weighted / (total * 10)) * 100) : 0;
    });
    return list.slice().sort((a, b) => b.fit - a.fit || a.name.localeCompare(b.name));
  };

  // How each part adds up to a suburb's fit, for the "Why this match?" breakdown.
  // Each part can add up to `max` points (its share of the weights); it earns `points` of
  // those in proportion to its 1–10 score. Points are rounded so they add up to exactly `fit`.
  SM.fitBreakdown = function (s) {
    const parts = s.parts.filter((p) => p.weight > 0);
    const total = parts.reduce((sum, p) => sum + p.weight, 0);
    const rows = parts.map(function (p) {
      const exact = (p.weight * p.score / (total * 10)) * 100;
      return { key: p.key, label: p.label, score: p.score, note: p.note, max: Math.round((p.weight / total) * 100), exact: exact, points: Math.floor(exact) };
    });
    // Largest remainder rounding
    let left = s.fit - rows.reduce((sum, r) => sum + r.points, 0);
    rows.slice().sort((a, b) => (b.exact - b.points) - (a.exact - a.points)).forEach(function (r) {
      if (left > 0) { r.points += 1; left -= 1; }
    });
    return rows;
  };

  // Everything a page needs, in one call.
  SM.init = async function () {
    const parkInfo = await SM.loadParks();
    return SM.compose(SM.buildSuburbs(parkInfo), parkInfo);
  };
  // Same as init but instant: no live parks (no network).
  SM.initSample = function () { return SM.compose(SM.buildSuburbs(null), null); };
  SM.compose = function (suburbs, parkInfo) {
    const prefs = SM.getPrefs();
    const ranked = SM.applyFit(suburbs, prefs);
    const bySlug = {};
    suburbs.forEach((s) => { bySlug[s.slug] = s; });
    return { suburbs: suburbs, ranked: ranked, bySlug: bySlug, prefs: prefs, parkInfo: parkInfo };
  };

  /* ------------------------------------------------------------------
     5. Listing card HTML (used by the home and rentals pages)
     ------------------------------------------------------------------ */
  SM.formatPrice = (n) => '$' + Number(n).toLocaleString('en-AU');

  /* Google Maps Platform key, used for:
       - listing photos: Street View Static API, looked up from each listing's lat/lng
       - nearby shops and cafés on the suburb page: Places API (New), see js/suburb.js
     Get it from Google Cloud > APIs & Services > Credentials. Leave it empty to turn both off.
     Restrict the key to your site's address and to those two APIs, because anyone can see it in the page source.
     Docs: https://developers.google.com/maps/documentation/streetview/request-streetview
     Images load only when a card scrolls into view (loading="lazy"), so you only pay for what people see. */
  SM.GOOGLE_MAPS_KEY = 'AIzaSyAaPAgRbPjWBBYLKT-OMO4bOEH_4W2zY6o';

  SM.streetViewURL = function (listing) {
    if (!SM.GOOGLE_MAPS_KEY || typeof listing.lat !== 'number') return null;
    return 'https://maps.googleapis.com/maps/api/streetview?size=640x400&fov=80&source=outdoor' +
      '&return_error_code=true' + // 404 instead of a grey "no imagery" picture, so the placeholder shows
      '&location=' + listing.lat + ',' + listing.lng + '&key=' + encodeURIComponent(SM.GOOGLE_MAPS_KEY);
  };

  // Median asking rent and number of listings for one suburb (from data/rentals.js).
  SM.rentStats = function (slug) {
    const prices = SM.RENTALS.filter((l) => l.slug === slug).map((l) => l.price).sort((a, b) => a - b);
    if (!prices.length) return { count: 0, median: null };
    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
    return { count: prices.length, median: median };
  };

  // `suburb` is the scored suburb from data/suburbs.js, or undefined for suburbs we don't score (no fit shown).
  SM.listingCardHTML = function (listing, suburb, isSaved) {
    const address = listing.street + ', ' + listing.suburb + ' ' + (listing.state || 'QLD') + ' ' + listing.postcode;
    const fitHTML = suburb
      ? '<p class="listing__fit" title="How well this suburb fits your priorities">' +
          '<span class="visually-hidden">Suburb fit </span>' + (suburb.fit / 10).toFixed(1) + SM.icon('smile') + '<span class="visually-hidden"> out of 10</span></p>'
      : '<p class="listing__fit listing__fit--none" title="We don\'t score this suburb yet">No fit score</p>';
    return (
      '<article class="listing" data-id="' + SM.esc(listing.id) + '">' +
        '<div class="listing__media">' +
          '<span>No photo available</span>' +
          (SM.streetViewURL(listing)
            ? '<img src="' + SM.esc(SM.streetViewURL(listing)) + '" alt="Street view near ' + SM.esc(address) + '" loading="lazy" decoding="async" onerror="this.remove()">'
            : '') +
          '<button class="save-btn" type="button" data-save-listing="' + SM.esc(listing.id) + '" aria-pressed="' + (isSaved ? 'true' : 'false') + '" ' +
            'aria-label="Save listing at ' + SM.esc(address) + '">' + SM.icon('star') + '</button>' +
        '</div>' +
        '<div class="listing__row">' +
          '<p class="listing__price">' + SM.formatPrice(listing.price) + '<span>/wk</span></p>' +
          '<span class="pill">' + SM.esc(listing.type) + '</span>' +
        '</div>' +
        (listing.title ? '<h3 class="listing__title">' + SM.esc(listing.title) + '</h3>' : '') +
        '<div class="listing__row">' +
          '<p class="listing__addr">' + SM.esc(address) + '</p>' + fitHTML +
        '</div>' +
        (listing.agency ? '<p class="listing__agency">Listed by ' + SM.esc(listing.agency) + '</p>' : '') +
        '<ul class="listing__facts" aria-label="Property features">' +
          '<li>' + SM.icon('bed') + listing.beds + '<span class="visually-hidden"> bedrooms</span></li>' +
          '<li>' + SM.icon('shower') + listing.baths + '<span class="visually-hidden"> bathrooms</span></li>' +
          '<li>' + SM.icon('car') + listing.cars + '<span class="visually-hidden"> car spaces</span></li>' +
        '</ul>' +
      '</article>'
    );
  };

  // Makes the star buttons inside `container` work. onChange runs after each toggle.
  SM.bindSaveButtons = function (container, onChange) {
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-save-listing]');
      if (!btn) return;
      const nowSaved = SM.toggleSaved('Listings', btn.dataset.saveListing);
      btn.setAttribute('aria-pressed', String(nowSaved));
      if (onChange) onChange();
    });
  };
})();
