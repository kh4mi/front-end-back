/* rentals.js — "Find a Rental": search, filters, saved listings */
(async function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  const listingsEl = $('#listings');
  listingsEl.innerHTML = '<p class="muted">Loading…</p>';
  const data = await SM.init();
  const prefs = data.prefs;
  const params = new URLSearchParams(window.location.search);

  const PAGE_SIZE = 48; // cards shown at first; "Show more" adds this many again
  let shownCount = PAGE_SIZE;

  // Every suburb that has listings: slug -> { name, postcode, count }
  const places = {};
  SM.RENTALS.forEach(function (l) {
    if (!places[l.slug]) places[l.slug] = { name: l.suburb, postcode: l.postcode, count: 0 };
    places[l.slug].count += 1;
  });
  // Suburbs that share a name (e.g. West End in Townsville) get their postcode added
  function placeName(slug) {
    if (data.bySlug[slug]) return data.bySlug[slug].name;
    const p = places[slug];
    if (!p) return slug;
    return p.name + (slug.endsWith('-' + p.postcode) ? ' ' + p.postcode : '');
  }

  // Fill the suburb dropdown: the suburbs we score first, then every other suburb, only those with listings
  const suburbSelect = $('#fSuburb');
  function addGroup(label, slugs) {
    const group = document.createElement('optgroup');
    group.label = label;
    slugs.sort((a, b) => placeName(a).localeCompare(placeName(b))).forEach(function (slug) {
      const opt = document.createElement('option');
      const p = places[slug];
      opt.value = slug;
      opt.textContent = placeName(slug) + ' ' + (p ? p.postcode + ' (' + p.count + ')' : (data.bySlug[slug].postcode + ' (0)'));
      group.appendChild(opt);
    });
    suburbSelect.appendChild(group);
  }
  const isBcc = (slug) => !!(data.bySlug[slug] && data.bySlug[slug].bcc);
  addGroup('Brisbane City suburbs', Object.keys(places).filter(isBcc));
  addGroup('Other Queensland suburbs', Object.keys(places).filter((slug) => !isBcc(slug)));

  // Starting filters: from the link (?suburb=…&q=…) and from the visitor's quiz answers
  const filters = {
    q: params.get('q') || '',
    area: SM.getArea(),
    suburb: data.bySlug[params.get('suburb')] || places[params.get('suburb')] ? params.get('suburb') : '',
    beds: prefs ? prefs.beds : 0,
    min: prefs && prefs.budget.min !== null ? prefs.budget.min : null,
    max: prefs && prefs.budget.max !== null ? prefs.budget.max : null,
    savedOnly: false
  };

  const els = {
    q: $('#q'), area: $('#fArea'), beds: $('#fBeds'), min: $('#fMin'), max: $('#fMax'),
    savedBtn: $('#savedBtn'), savedCount: $('#savedCount'),
    chips: $('#filterChips'), count: $('#resultCount'),
    panel: $('#filterPanel'), edit: $('#editFilters')
  };

  function syncInputs() {
    els.q.value = filters.q;
    els.area.value = filters.area;
    suburbSelect.value = filters.suburb;
    els.beds.value = String(filters.beds || 0);
    els.min.value = filters.min === null ? '' : filters.min;
    els.max.value = filters.max === null ? '' : filters.max;
  }

  // The area only narrows a general browse: picking a suburb or searching by name finds it anywhere in Queensland
  const areaApplies = () => !filters.suburb && !filters.q;

  function matches(l) {
    if (filters.suburb && l.slug !== filters.suburb) return false;
    if (areaApplies() && !SM.inArea(data.bySlug[l.slug], filters.area)) return false;
    if (filters.beds && l.beds < filters.beds) return false;
    if (filters.min !== null && l.price < filters.min) return false;
    if (filters.max !== null && l.price > filters.max) return false;
    if (filters.savedOnly && SM.getSaved('Listings').indexOf(l.id) < 0) return false;
    if (filters.q) {
      const hay = (l.title + ' ' + l.street + ' ' + l.suburb + ' ' + l.postcode + ' ' + l.type).toLowerCase();
      if (!filters.q.toLowerCase().split(/\s+/).every((w) => hay.indexOf(w) >= 0)) return false;
    }
    return true;
  }

  function renderChips() {
    const chips = [];
    if (filters.suburb) chips.push(['suburb', placeName(filters.suburb)]);
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

  // Filters changed: start again from the first page of results
  function render() {
    shownCount = PAGE_SIZE;
    draw();
  }

  function draw() {
    const saved = SM.getSaved('Listings');
    els.savedCount.textContent = saved.length;

    // Best fit first; suburbs we don't score go after the ones we do
    const fitOf = (l) => (data.bySlug[l.slug] ? data.bySlug[l.slug].fit : -1);
    const results = SM.RENTALS.filter(matches).sort((a, b) => fitOf(b) - fitOf(a) || a.price - b.price);

    renderChips();
    const where = filters.suburb ? ' in ' + placeName(filters.suburb) : areaApplies() && filters.area === 'brisbane' ? ' in Brisbane City' : '';
    els.count.textContent = results.length + (results.length === 1 ? ' rental' : ' rentals') + where + (results.length === 1 ? ' matches' : ' match') + ' your filters, sorted by best fit';

    if (!results.length) {
      listingsEl.innerHTML = '<div class="empty-state"><p><strong>No rentals match these filters.</strong></p><p>Try a wider price range or fewer bedrooms.</p><button class="btn" type="button" id="emptyClear">Clear filters</button></div>';
      return;
    }
    const more = results.length - shownCount;
    listingsEl.innerHTML = results.slice(0, shownCount).map((l) => SM.listingCardHTML(l, data.bySlug[l.slug], saved.indexOf(l.id) >= 0)).join('') +
      (more > 0 ? '<div class="listing-more"><button class="btn btn-lg" type="button" id="showMore">Show ' + Math.min(more, PAGE_SIZE) + ' more of ' + more + '</button></div>' : '');
  }

  function readInputs() {
    filters.suburb = suburbSelect.value;
    filters.area = els.area.value;
    SM.setArea(filters.area);
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
  [suburbSelect, els.area, els.beds, els.min, els.max].forEach((el) => el.addEventListener('change', readInputs));
  $('#clearFilters').addEventListener('click', clearAll);
  listingsEl.addEventListener('click', function (e) {
    if (e.target.id === 'emptyClear') clearAll();
    if (e.target.id === 'showMore') {
      const firstNew = shownCount;
      shownCount += PAGE_SIZE;
      draw();
      // Move focus to the first new card so keyboard users carry on from where they were
      const card = listingsEl.querySelectorAll('.listing')[firstNew];
      if (card) { card.setAttribute('tabindex', '-1'); card.focus(); }
    }
  });
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
    if (filters.savedOnly) draw();
  });

  syncInputs();
  render();
})();
