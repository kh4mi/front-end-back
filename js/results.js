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
  const area = SM.getArea();
  const shown = data.ranked.filter((s) => SM.inArea(s, area)).slice(0, MAX_SHOWN);
  const areaPick = $('#areaPick');
  areaPick.value = area;
  areaPick.addEventListener('change', function () { SM.setArea(areaPick.value); window.location.reload(); });
  const dest = SM.destinationOf(prefs);

  /* ---------- Heading, chips, notes ---------- */
  $('#resultsHeading').textContent = prefs
    ? shown.length + ' suburbs match your priorities'
    : 'Top ' + shown.length + ' suburbs to explore';
  if (area === 'qld') $('#sortNote').textContent = 'Sorted by overall fit. Outside Brisbane City, missing transport or park data counts as average, so those suburbs can rank higher than the data really shows.';

  const chipsEl = $('#filterChips');
  if (prefs) {
    chipsEl.innerHTML = prefs.order
      .filter((k) => prefs.weights[k] >= 3)
.map((k) => '<li class="chip" data-factor="' + k + '">' + SM.esc(SM.factor(k).short) + ': ' + SM.level(prefs.weights[k]) + '</li>')
      .join('');
    if (prefs.budget.max !== null) chipsEl.innerHTML += '<li class="chip">Rent up to ' + SM.formatPrice(prefs.budget.max) + '/wk</li>';
    if (prefs.beds > 1) chipsEl.innerHTML += '<li class="chip">' + prefs.beds + '+ bedrooms</li>';
    if (dest) chipsEl.innerHTML += '<li class="chip">Near ' + SM.esc(dest.label) + '</li>';
  }

  // Saved suburbs (starred on a suburb page), best fit first
  const savedSlugs = SM.getSaved('Suburbs');
  const saved = data.ranked.filter((s) => savedSlugs.indexOf(s.slug) >= 0);
  if (saved.length) {
    const savedEl = $('#savedSuburbs');
    savedEl.hidden = false;
    savedEl.innerHTML = '<h2>Your saved suburbs</h2><ul class="chips">' + saved.map((s) =>
      '<li><a class="chip" href="suburbSummary.html?s=' + s.slug + '">★ ' + SM.esc(s.name) + ' · ' + s.fit + '% fit</a></li>').join('') + '</ul>';
  }

  // How the scores are worked out is explained on How it works; here we only nudge people who skipped the quiz
  if (!prefs) $('#dataNotes').innerHTML = '<div class="notice notice--info"><p><strong>Showing equal weights.</strong> <a href="quiz.html">Take the 5-question quiz</a> to rank suburbs by what matters to you.</p></div>';

  /* ---------- List ---------- */
  listEl.innerHTML = shown.map(function (s, i) {
    const scores = SM.FACTORS.map(function (f) {
      return '<li class="score" data-factor="' + f.key + '"><span class="score__label">' + SM.esc(f.short) + '</span> ' + SM.scoreText(s.scores[f.key]) + '</li>';
    }).join('');
    const why = SM.fitBreakdown(s).map(function (r) {
      return '<li class="why__row" data-factor="' + r.key + '">' +
               '<span class="why__label">' + SM.esc(r.label) + ' <span class="muted">(' + r.score + '/10' + (r.note ? ', ' + SM.esc(r.note) : '') + ')</span></span>' +
               '<span class="why__bar" aria-hidden="true"><span style="width:' + (r.max ? (r.points / r.max) * 100 : 0) + '%"></span></span>' +
               '<span class="why__pts">+' + r.points + '<span class="muted"> of ' + r.max + '</span></span>' +
             '</li>';
    }).join('');
    const whyIntro = prefs
      ? 'Each part can add up to the points shown, based on how you ranked and rated it (factors you rated 1 are left out). Your budget, bedrooms and destination count as "important". A suburb earns each part\'s points in proportion to its score.'
      : 'All four factors count equally until you take the quiz. A suburb earns each factor\'s points in proportion to its score.';
    const rankClass = i < 3 ? ' match-card--top rank-' + (i + 1) : '';
    const rankLabel = i === 0 ? 'Top match' : 'Match';
    const distance = dest
      ? '<p class="match-card__dist">' + SM.km(s, dest).toFixed(1) + ' km to ' + SM.esc(dest.label) + ' (straight line)</p>' : '';
    return (
      '<li class="match-card' + rankClass + '" id="card-' + s.slug + '" data-slug="' + s.slug + '">' +
        '<p class="match-card__rank"><span class="rank-badge">#' + (i + 1) + '</span> ' + rankLabel + ' – ' + s.fit + '% fit' +
          (savedSlugs.indexOf(s.slug) >= 0 ? ' <span class="match-card__saved">★ Saved</span>' : '') + '</p>' +
        '<h2>' + SM.esc(s.name) + ', ' + s.postcode + '</h2>' +
        '<ul class="scores" aria-label="Scores out of 10">' + scores + '</ul>' + distance +
        '<details class="why">' +
          '<summary>Why ' + s.fit + '%?</summary>' +
          '<p class="why__intro">' + whyIntro + '</p>' +
          '<ul class="why__list" aria-label="How each factor adds to the ' + s.fit + '% fit">' + why + '</ul>' +
          '<p class="why__total">Total: <strong>' + s.fit + '% fit</strong> · <a href="how-it-works.html">How scoring works</a></p>' +
        '</details>' +
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
      // Top 3 get gold, silver and bronze pins that sit above the others.
      const top = i < 3;
      const size = top ? 42 : 34;
      const icon = L.divIcon({ className: 'map-pin' + (top ? ' map-pin--top rank-' + (i + 1) : ''), html: '<span>' + (i + 1) + '</span>', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -(size / 2 + 1)] });
      const m = L.marker([s.lat, s.lng], { icon: icon, title: '#' + (i + 1) + ' ' + s.name + ', ' + s.fit + '% fit', alt: '#' + (i + 1) + ' ' + s.name, zIndexOffset: top ? 1000 - i * 100 : 0 })
        .addTo(map)
        .bindPopup('<strong>#' + (i + 1) + ' ' + SM.esc(s.name) + '</strong><br>' + s.fit + '% fit<br><a href="suburbSummary.html?s=' + s.slug + '">View suburb</a>');
      m.on('click', function () { select(s.slug, false); const c = document.getElementById('card-' + s.slug); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
      markers[s.slug] = m;
      bounds.push([s.lat, s.lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });

    // Legend: explains that the pin numbers are ranks
    const legend = L.control({ position: 'topright' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = '<p><strong>Pin numbers = rank</strong></p>' +
        '<ul><li><span class="map-legend__dot rank-1"></span>#1 best match</li>' +
        '<li><span class="map-legend__dot rank-2"></span>#2</li>' +
        '<li><span class="map-legend__dot rank-3"></span>#3</li></ul>';
      return div;
    };
    legend.addTo(map);
    window.addEventListener('resize', function () { map.invalidateSize(); });
  }

  listEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-show]');
    if (btn) select(btn.dataset.show, true);
  });
  if (shown.length) select(shown[0].slug, false);
})();
