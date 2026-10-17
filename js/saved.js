/* saved.js — "Saved" page: the suburbs and listings the visitor has starred.
   Stars are saved in this browser (per account when logged in, see SM.store in app.js). */
(async function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  try {
    const session = JSON.parse(window.localStorage.getItem('sm.session') || 'null');
    if (session) $('#savedWho').textContent = 'Saved to your account (' + session.email + ') in this browser.';
  } catch (e) { /* no storage */ }

  const data = await SM.init();

  function drawSuburbs() {
    const saved = SM.getSaved('Suburbs');
    const list = data.ranked.filter((s) => saved.indexOf(s.slug) >= 0); // best fit first
    $('#suburbCount').textContent = '(' + list.length + ')';
    $('#savedSuburbList').innerHTML = list.length ? list.map(function (s) {
      const scores = SM.FACTORS.map((f) =>
        '<li class="score" data-factor="' + f.key + '"><span class="score__label">' + SM.esc(f.short) + '</span> ' + SM.scoreText(s.scores[f.key]) + '</li>').join('');
      return (
        '<li class="saved-suburb">' +
          '<div>' +
            '<p class="saved-suburb__fit">' + s.fit + '% fit</p>' +
            '<h3>' + SM.esc(s.name) + ', ' + s.postcode + '</h3>' +
            '<ul class="scores" aria-label="Scores out of 10">' + scores + '</ul>' +
          '</div>' +
          '<div class="saved-suburb__actions">' +
            '<a class="btn btn-primary" href="suburbSummary.html?s=' + s.slug + '">View ' + SM.esc(s.name) + '</a>' +
            '<a class="btn" href="rentals.html?suburb=' + s.slug + '">Rentals</a>' +
            '<button class="btn" type="button" data-unsave-suburb="' + s.slug + '" aria-label="Remove ' + SM.esc(s.name) + ' from saved">Remove</button>' +
          '</div>' +
        '</li>'
      );
    }).join('') : '<li class="saved-empty">No saved suburbs yet. Open a suburb from <a href="results.html">Browse suburbs</a> and press <strong>Save Suburb</strong>.</li>';
  }

  function drawListings() {
    const saved = SM.getSaved('Listings');
    const list = SM.RENTALS.filter((l) => saved.indexOf(l.id) >= 0);
    $('#listingCount').textContent = '(' + list.length + ')';
    $('#savedListingGrid').innerHTML = list.length
      ? list.map((l) => SM.listingCardHTML(l, data.bySlug[l.slug], true)).join('')
      : '<p class="saved-empty">No saved listings yet. Press the star on any listing in <a href="rentals.html">Find a Rental</a>.</p>';
  }

  $('#savedSuburbList').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-unsave-suburb]');
    if (!btn) return;
    SM.toggleSaved('Suburbs', btn.dataset.unsaveSuburb);
    drawSuburbs();
  });
  // Un-starring a listing takes it off this page
  SM.bindSaveButtons($('#savedListingGrid'), drawListings);

  drawSuburbs();
  drawListings();
})();
