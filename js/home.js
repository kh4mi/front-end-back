/* home.js — landing page: rentals carousel and search box */
(function () {
  'use strict';
  const track = document.getElementById('track');

  function render(bySlug) {
    const saved = SM.getSaved('Listings');
    track.innerHTML = SM.RENTALS.slice(0, 8)
      .map((l) => SM.listingCardHTML(l, bySlug[l.suburb], saved.indexOf(l.id) >= 0))
      .join('');
    // role="list" needs role="listitem" children
    track.querySelectorAll('.listing').forEach((el) => el.setAttribute('role', 'listitem'));
  }

  // Show cards straight away using sample scores, then refresh once live park data has loaded.
  render(SM.initSample().bySlug);
  SM.init().then((data) => render(data.bySlug));

  SM.bindSaveButtons(track);

  const step = () => Math.max(track.clientWidth * 0.8, 240);
  document.getElementById('prevBtn').addEventListener('click', () => track.scrollBy({ left: -step() }));
  document.getElementById('nextBtn').addEventListener('click', () => track.scrollBy({ left: step() }));

  document.getElementById('searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const q = document.getElementById('q').value.trim();
    window.location.href = 'rentals.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
})();
