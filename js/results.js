/* ==========================================================================
   results.js — ranked suburb list + map

   Map: Leaflet 1.9.4 (https://leafletjs.com/reference.html), loaded from cdnjs.
   Map tiles: © OpenStreetMap contributors (https://www.openstreetmap.org/copyright)
   ========================================================================== */
(async function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);
  const MAX_SHOWN = 12;

  const listEl = $('#matchList');
  listEl.innerHTML = '<li class="muted">Loading suburb data…</li>';

  const data = await SM.init();
  const prefs = data.prefs;
  const shown = data.ranked.slice(0, MAX_SHOWN);
  const dest = prefs && SM.DESTINATIONS[prefs.destination] && SM.DESTINATIONS[prefs.destination].label
    ? SM.DESTINATIONS[prefs.destination] : null;

  /* ---------- Heading, chips, notes ---------- */
  $('#resultsHeading').textContent = prefs
    ? shown.length + ' suburbs match your priorities'
    : 'Top ' + shown.length + ' suburbs to explore';

  const chipsEl = $('#filterChips');
  if (prefs) {
    chipsEl.innerHTML = prefs.order
      .filter((k) => prefs.weights[k] >= 3)
.map((k) => '<li class="chip" data-factor="' + k + '">' + SM.esc(SM.factor(k).short) + ': ' + SM.level(prefs.weights[k]) + '</li>')      .join('');
  }

  const notes = SM.dataNotes(data.parkInfo).map((t) => '<p>' + SM.esc(t) + '</p>');
  if (!prefs) notes.unshift('<p><strong>Showing equal weights.</strong> <a href="quiz.html">Take the 5-question quiz</a> to rank suburbs by what matters to you.</p>');
  $('#dataNotes').innerHTML = '<div class="notice notice--info">' + notes.join('') + '</div>';

  /* ---------- List ---------- */
  listEl.innerHTML = shown.map(function (s, i) {
    const scores = SM.FACTORS.map(function (f) {
      return '<li class="score" data-factor="' + f.key + '"><span aria-hidden="true">' + f.emoji + '</span>' +
             '<span class="visually-hidden">' + SM.esc(f.label) + ' </span>' + s.scores[f.key] + '/10</li>';
    }).join('');
    const distance = dest
      ? '<p class="match-card__dist">' + SM.km(s, dest).toFixed(1) + ' km to ' + SM.esc(dest.label) + ' (straight line)</p>' : '';
    return (
      '<li class="match-card" id="card-' + s.slug + '" data-slug="' + s.slug + '">' +
        '<p class="match-card__rank">#' + (i + 1) + ' Match – ' + s.fit + '% fit</p>' +
        '<h2>' + SM.esc(s.name) + ', ' + s.postcode + '</h2>' +
        '<ul class="scores" aria-label="Scores out of 10">' + scores + '</ul>' + distance +
        '<div class="match-card__actions">' +
          '<button class="btn" type="button" data-show="' + s.slug + '">Show on map</button>' +
          '<a class="btn btn-primary" href="suburbSummary.html?s=' + s.slug + '">View ' + SM.esc(s.name) + '</a>' +
        '</div>' +
      '</li>'
    );
  }).join('');

  /* ---------- Map ---------- */
  const markers = {};
  let leafletMap = null; // (not called `map`: an element with id="map" already claims that global name)
  const mapEl = $('#map');

  function select(slug, fly) {
    document.querySelectorAll('.match-card').forEach(function (c) {
      const on = c.dataset.slug === slug;
      c.classList.toggle('is-selected', on);
      if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
    Object.keys(markers).forEach(function (k) {
      const el = markers[k].getElement();
      if (el) el.classList.toggle('is-selected', k === slug);
    });
    if (markers[slug] && fly && leafletMap) {
      leafletMap.flyTo(markers[slug].getLatLng(), Math.max(leafletMap.getZoom(), 13), { duration: 0.6 });
      markers[slug].openPopup();
    }
  }

  if (!window.L) {
    mapEl.innerHTML = '<div class="map-fallback"><p><strong>The map could not load.</strong></p><p>Check your internet connection. The list of suburbs still works.</p></div>';
  } else {
    const map = (leafletMap = L.map('map', { scrollWheelZoom: true }).setView([-27.47, 153.02], 11));
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const bounds = [];
    shown.forEach(function (s, i) {
      const icon = L.divIcon({ className: 'map-pin', html: '<span>' + (i + 1) + '</span>', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18] });
      const m = L.marker([s.lat, s.lng], { icon: icon, title: s.name + ', ' + s.fit + '% fit', alt: s.name })
        .addTo(map)
        .bindPopup('<strong>' + SM.esc(s.name) + '</strong><br>' + s.fit + '% fit<br><a href="suburbSummary.html?s=' + s.slug + '">View suburb</a>');
      m.on('click', function () { select(s.slug, false); const c = document.getElementById('card-' + s.slug); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
      markers[s.slug] = m;
      bounds.push([s.lat, s.lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
    window.addEventListener('resize', function () { map.invalidateSize(); });
  }

  listEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-show]');
    if (btn) select(btn.dataset.show, true);
  });
  if (shown.length) select(shown[0].slug, false);
})();
