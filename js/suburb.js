/* suburb.js — suburb detail page. Reads the suburb from the URL: suburb.html?s=toowong */
(async function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  const slug = new URLSearchParams(window.location.search).get('s') || 'toowong';
  const data = await SM.init();
  const s = data.bySlug[slug];

  if (!s) {
    $('#suburbName').textContent = 'Suburb not found';
    $('#suburbSubtitle').innerHTML = 'We don\'t have that suburb yet. <a href="results.html">Browse suburbs</a>.';
    return;
  }

  document.title = s.name + ' – SiteName';
  $('#suburbName').textContent = s.name;
  $('#suburbSubtitle').textContent = s.fit + '% fit · ' + s.kmCbd.toFixed(1) + ' km from Brisbane CBD · Postcode ' + s.postcode;

  // Score bars
  $('#bars').innerHTML = SM.FACTORS.map(function (f) {
    const v = s.scores[f.key];
    return (
      '<div class="bar" data-factor="' + f.key + '">' +
        '<span class="bar__label"><span aria-hidden="true">' + f.emoji + '</span> ' + SM.esc(f.short) + '</span>' +
        '<span class="bar__track" aria-hidden="true"><span class="bar__fill" style="--score:' + v + '"></span></span>' +
        '<span class="bar__num">' + v + '/10</span>' +
      '</div>'
    );
  }).join('');

  // Amenities: live park names from the Brisbane City Council dataset, plus straight-line distances
  const chips = [];
  const dests = ['uq', 'qut', 'cbd'];
  dests.forEach(function (key) {
    const d = SM.DESTINATIONS[key];
    chips.push('<li class="chip">' + SM.km(s, d).toFixed(1) + ' km to ' + SM.esc(d.label) + '</li>');
  });
  const names = Array.from(new Set(s.parkNames)).slice(0, 10);
  names.forEach((n) => chips.push('<li class="chip">' + SM.icon('pin') + SM.esc(n) + '</li>'));
  $('#amenities').innerHTML = chips.join('');

  const info = data.parkInfo;
  if (s.parksLive) {
    const how = info.method === 'radius' ? 'within 1.5 km of the suburb centre' : 'in ' + s.name;
    $('#amenityNote').textContent = s.parkCount + ' parks ' + how + ' in Brisbane City Council\'s park dataset' +
      (names.length ? ' (first ' + names.length + ' shown)' : '') + '. Distances are straight-line, not travel time.';
  } else {
    $('#amenityNote').textContent = 'Park names are unavailable because live park data could not be loaded. Distances are straight-line, not travel time.';
  }

  $('#dataNotes').innerHTML = '<div class="notice notice--info">' + SM.dataNotes(info).map((t) => '<p>' + SM.esc(t) + '</p>').join('') + '</div>';

  // Rentals link
  const link = $('#rentalsLink');
  link.href = 'rentals.html?suburb=' + encodeURIComponent(s.slug);
  link.innerHTML = 'View rentals in ' + SM.esc(s.name) + ' <span aria-hidden="true">→</span>';

  // Save suburb
  const saveBtn = $('#saveBtn');
  const label = $('#saveLabel');
  function paintSave() {
    const saved = SM.getSaved('Suburbs').indexOf(s.slug) >= 0;
    saveBtn.setAttribute('aria-pressed', String(saved));
    label.textContent = saved ? 'Saved' : 'Save Suburb';
  }
  saveBtn.addEventListener('click', function () { SM.toggleSaved('Suburbs', s.slug); paintSave(); });
  paintSave();
})();
