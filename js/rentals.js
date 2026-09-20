/* rentals.js — "Find a Rental": search, filters, saved listings */
(async function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  const listingsEl = $('#listings');
  listingsEl.innerHTML = '<p class="muted">Loading…</p>';
  const data = await SM.init();
  const prefs = data.prefs;
  const params = new URLSearchParams(window.location.search);

  // Fill the suburb dropdown
  const suburbSelect = $('#fSuburb');
  data.suburbs.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(function (s) {
    const opt = document.createElement('option');
    opt.value = s.slug;
    opt.textContent = s.name + ' ' + s.postcode;
    suburbSelect.appendChild(opt);
  });

  // Starting filters: from the link (?suburb=…&q=…) and from the visitor's quiz answers
  const filters = {
    q: params.get('q') || '',
    suburb: data.bySlug[params.get('suburb')] ? params.get('suburb') : '',
    beds: prefs ? prefs.beds : 0,
    min: prefs && prefs.budget.min !== null ? prefs.budget.min : null,
    max: prefs && prefs.budget.max !== null ? prefs.budget.max : null,
    savedOnly: false
  };

  const els = {
    q: $('#q'), beds: $('#fBeds'), min: $('#fMin'), max: $('#fMax'),
    savedBtn: $('#savedBtn'), savedCount: $('#savedCount'),
    chips: $('#filterChips'), count: $('#resultCount'),
    panel: $('#filterPanel'), edit: $('#editFilters')
  };

  function syncInputs() {
    els.q.value = filters.q;
    suburbSelect.value = filters.suburb;
    els.beds.value = String(filters.beds || 0);
    els.min.value = filters.min === null ? '' : filters.min;
    els.max.value = filters.max === null ? '' : filters.max;
  }

  function matches(l) {
    const s = data.bySlug[l.suburb];
    if (filters.suburb && l.suburb !== filters.suburb) return false;
    if (filters.beds && l.beds < filters.beds) return false;
    if (filters.min !== null && l.price < filters.min) return false;
    if (filters.max !== null && l.price > filters.max) return false;
    if (filters.savedOnly && SM.getSaved('Listings').indexOf(l.id) < 0) return false;
    if (filters.q) {
      const hay = (l.street + ' ' + s.name + ' ' + s.postcode + ' ' + l.type).toLowerCase();
      if (!filters.q.toLowerCase().split(/\s+/).every((w) => hay.indexOf(w) >= 0)) return false;
    }
    return true;
  }

  function renderChips() {
    const chips = [];
    if (filters.suburb) chips.push(['suburb', data.bySlug[filters.suburb].name]);
    if (filters.beds) chips.push(['beds', filters.beds + '+ beds']);
    if (filters.min !== null || filters.max !== null) {
      const lo = filters.min !== null ? SM.formatPrice(filters.min) : '$0';
      const hi = filters.max !== null ? SM.formatPrice(filters.max) : 'any';
      chips.push(['price', lo + '–' + hi + '/wk']);
    }
    if (filters.q) chips.push(['q', '“' + filters.q + '”']);
    if (filters.savedOnly) chips.push(['savedOnly', 'Saved only']);
    els.chips.innerHTML = chips.map((c) =>
      '<li><button class="chip" type="button" data-remove="' + c[0] + '" aria-label="Remove filter: ' + SM.esc(c[1]) + '">' + SM.esc(c[1]) + ' <span aria-hidden="true">×</span></button></li>'
    ).join('');
  }

  function render() {
    const saved = SM.getSaved('Listings');
    els.savedCount.textContent = saved.length;

    const results = SM.RENTALS.filter(matches).sort(function (a, b) {
      return data.bySlug[b.suburb].fit - data.bySlug[a.suburb].fit || a.price - b.price;
    });

    renderChips();
    const where = filters.suburb ? ' in ' + data.bySlug[filters.suburb].name : '';
    els.count.textContent = results.length + (results.length === 1 ? ' rental' : ' rentals') + where + (results.length === 1 ? ' matches' : ' match') + ' your filters, sorted by best fit';

    if (!results.length) {
      listingsEl.innerHTML = '<div class="empty-state"><p><strong>No rentals match these filters.</strong></p><p>Try a wider price range or fewer bedrooms.</p><button class="btn" type="button" id="emptyClear">Clear filters</button></div>';
      return;
    }
    listingsEl.innerHTML = results.map((l) => SM.listingCardHTML(l, data.bySlug[l.suburb], saved.indexOf(l.id) >= 0)).join('');
  }

  function readInputs() {
    filters.suburb = suburbSelect.value;
    filters.beds = Number(els.beds.value);
    filters.min = els.min.value === '' ? null : Number(els.min.value);
    filters.max = els.max.value === '' ? null : Number(els.max.value);
    render();
  }

  function clearAll() {
    filters.q = ''; filters.suburb = ''; filters.beds = 0; filters.min = null; filters.max = null; filters.savedOnly = false;
    els.savedBtn.setAttribute('aria-pressed', 'false');
    syncInputs();
    render();
  }

  // Events
  [suburbSelect, els.beds, els.min, els.max].forEach((el) => el.addEventListener('change', readInputs));
  $('#clearFilters').addEventListener('click', clearAll);
  listingsEl.addEventListener('click', function (e) { if (e.target.id === 'emptyClear') clearAll(); });
  $('#searchForm').addEventListener('submit', function (e) { e.preventDefault(); filters.q = els.q.value.trim(); render(); });
  els.edit.addEventListener('click', function () {
    const open = els.panel.hidden;
    els.panel.hidden = !open;
    els.edit.setAttribute('aria-expanded', String(open));
  });
  els.savedBtn.addEventListener('click', function () {
    filters.savedOnly = !filters.savedOnly;
    els.savedBtn.setAttribute('aria-pressed', String(filters.savedOnly));
    render();
  });
  els.chips.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const what = btn.dataset.remove;
    if (what === 'suburb') filters.suburb = '';
    if (what === 'beds') filters.beds = 0;
    if (what === 'price') { filters.min = null; filters.max = null; }
    if (what === 'q') filters.q = '';
    if (what === 'savedOnly') { filters.savedOnly = false; els.savedBtn.setAttribute('aria-pressed', 'false'); }
    syncInputs();
    render();
  });
  SM.bindSaveButtons(listingsEl, function () {
    // Saving changes the count; if we're showing "saved only", removing a star removes the card.
    els.savedCount.textContent = SM.getSaved('Listings').length;
    if (filters.savedOnly) render();
  });

  syncInputs();
  render();
})();
