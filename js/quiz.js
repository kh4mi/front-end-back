/* ==========================================================================
   quiz.js — 5-step matching quiz. Saves answers to localStorage (SM.store).

   Drag-and-drop reordering follows the pattern in MDN's
   "HTML Drag and Drop API" guide:
   https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
   Touch screens don't support that API, so every row also has up/down buttons.
   ========================================================================== */
(function () {
  'use strict';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const TOTAL_STEPS = 5;
  let step = 1;

  // Start from saved answers if the visitor has done the quiz before.
  const base = SM.getPrefs() || SM.DEFAULT_PREFS;
  const state = {
    order: base.order.slice(),
    weights: Object.assign({}, base.weights),
    budget: { min: base.budget.min, max: base.budget.max },
    beds: base.beds,
    destination: base.destination,
    consent: !!SM.store.get('consent', false)
  };

  /* ---------- Step 1: ranking list ---------- */
  const list = $('#rankList');
  const live = $('#rankLive');

  function renderRankList() {
    list.innerHTML = state.order.map(function (key) {
      const f = SM.factor(key);
      let radios = '';
      for (let n = 1; n <= 5; n++) {
        radios += '<label class="rating__opt"><input type="radio" name="w-' + key + '" value="' + n + '"' + (state.weights[key] === n ? ' checked' : '') + '>' +
                  '<span>' + n + '</span><span class="visually-hidden"> out of 5</span></label>';
      }
      return (
        '<li class="rank-item" draggable="true" data-key="' + key + '">' +
          '<span class="rank-item__grip" aria-hidden="true">⠿</span>' +
          '<span class="rank-item__pos" aria-hidden="true"></span>' +
          '<span class="rank-item__label"><span aria-hidden="true">' + f.emoji + '</span> ' + SM.esc(f.label) + '</span>' +
          '<div class="rank-item__controls">' +
            '<fieldset class="rating"><legend class="visually-hidden">How much does ' + SM.esc(f.label) + ' matter? 1 is a little, 5 is a lot.</legend>' +
              '<span class="rating__scale">' + radios + '</span>' +
              '<span class="rating__hint" aria-hidden="true">1 = a little · 5 = a lot</span>' +
            '</fieldset>' +
            '<span class="rank-item__moves">' +
              '<button type="button" data-move="up" aria-label="Move ' + SM.esc(f.label) + ' up">↑</button>' +
              '<button type="button" data-move="down" aria-label="Move ' + SM.esc(f.label) + ' down">↓</button>' +
            '</span>' +
          '</div>' +
        '</li>'
      );
    }).join('');
    refreshPositions();
  }

  // Updates the numbers and disables the up/down buttons at the ends.
  function refreshPositions() {
    const items = $$('.rank-item', list);
    items.forEach(function (li, i) {
      $('.rank-item__pos', li).textContent = i + 1;
      $('[data-move="up"]', li).disabled = i === 0;
      $('[data-move="down"]', li).disabled = i === items.length - 1;
    });
    state.order = items.map((li) => li.dataset.key);
  }

  list.addEventListener('change', function (e) {
    if (e.target.matches('input[type="radio"]')) {
      state.weights[e.target.name.replace('w-', '')] = Number(e.target.value);
    }
  });

  list.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-move]');
    if (!btn) return;
    const li = btn.closest('.rank-item');
    if (btn.dataset.move === 'up' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
    if (btn.dataset.move === 'down' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
    refreshPositions();
    // Keep keyboard focus on a usable button, and tell screen reader users what happened.
    const stillEnabled = btn.disabled ? $('[data-move="' + (btn.dataset.move === 'up' ? 'down' : 'up') + '"]', li) : btn;
    stillEnabled.focus();
    live.textContent = SM.factor(li.dataset.key).label + ' is now number ' + (Array.from(list.children).indexOf(li) + 1) + ' of ' + list.children.length + '.';
  });

  // Drag and drop (mouse)
  let dragging = null;
  list.addEventListener('dragstart', function (e) {
    dragging = e.target.closest('.rank-item');
    if (!dragging) return;
    dragging.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragging.dataset.key);
  });
  list.addEventListener('dragover', function (e) {
    if (!dragging) return;
    e.preventDefault();
    const after = $$('.rank-item:not(.is-dragging)', list).find(function (el) {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (after) list.insertBefore(dragging, after); else list.appendChild(dragging);
  });
  list.addEventListener('dragend', function () {
    if (dragging) dragging.classList.remove('is-dragging');
    dragging = null;
    refreshPositions();
  });

  /* ---------- Steps 2–4: budget, destination, bedrooms ---------- */
  const budgetMin = $('#budgetMin');
  const budgetMax = $('#budgetMax');
  const budgetError = $('#budgetError');
  budgetMin.value = state.budget.min === null ? '' : state.budget.min;
  budgetMax.value = state.budget.max === null ? '' : state.budget.max;

  $('input[name="destination"][value="' + state.destination + '"]').checked = true;
  $('input[name="beds"][value="' + state.beds + '"]').checked = true;
  $$('input[name="destination"]').forEach((r) => r.addEventListener('change', () => { state.destination = r.value; }));
  $$('input[name="beds"]').forEach((r) => r.addEventListener('change', () => { state.beds = Number(r.value); }));

  function readBudget() {
    const min = budgetMin.value === '' ? null : Number(budgetMin.value);
    const max = budgetMax.value === '' ? null : Number(budgetMax.value);
    if ((min !== null && (isNaN(min) || min < 0)) || (max !== null && (isNaN(max) || max < 0))) {
      return { error: 'Enter amounts of $0 or more.' };
    }
    if (min !== null && max !== null && min > max) {
      return { error: 'The "From" amount must be less than or equal to the "To" amount.' };
    }
    return { min: min, max: max };
  }

  /* ---------- Step 5: review ---------- */
  function renderReview() {
    const dest = SM.DESTINATIONS[state.destination];
    const budget = state.budget.min === null && state.budget.max === null
      ? 'No limit set'
      : (state.budget.min !== null ? SM.formatPrice(state.budget.min) : '$0') + ' to ' + (state.budget.max !== null ? SM.formatPrice(state.budget.max) : 'any') + ' per week';
    const priorities = state.order.map((k, i) => (i + 1) + '. ' + SM.factor(k).label + ' (' + SM.level(state.weights[k]) + ')').join(', ');
    const rows = [
      ['Your priorities', priorities],
      ['Weekly rent', budget],
      ['Main destination', dest.label || 'Not set'],
      ['Bedrooms', state.beds + ' or more']
    ];
    $('#review').innerHTML = rows.map((r) => '<dt>' + SM.esc(r[0]) + '</dt><dd>' + SM.esc(r[1]) + '</dd>').join('');
  }

  /* ---------- Navigation ---------- */
  const backBtn = $('#backBtn');
  const nextBtn = $('#nextBtn');
  const consent = $('#consent');
  const consentError = $('#consentError');
  consent.checked = state.consent;

  function showStep(n, moveFocus) {
    step = n;
    $$('.step').forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    $('#progressText').textContent = 'Question ' + n + ' of ' + TOTAL_STEPS;
    $('#progressFill').style.width = (n / TOTAL_STEPS) * 100 + '%';
    backBtn.disabled = n === 1;
    nextBtn.textContent = n === TOTAL_STEPS ? 'See my suburbs' : 'Next';
    if (n === TOTAL_STEPS) renderReview();
    const heading = $('.step[data-step="' + n + '"] h2');
    if (heading && moveFocus) heading.focus();
  }

  backBtn.addEventListener('click', function () { if (step > 1) showStep(step - 1, true); });

  nextBtn.addEventListener('click', function () {
    if (step === 2) {
      const b = readBudget();
      if (b.error) { budgetError.textContent = b.error; budgetError.hidden = false; return; }
      budgetError.hidden = true;
      state.budget = b;
    }
    if (step < TOTAL_STEPS) { showStep(step + 1, true); return; }

    // Final step: consent is required before saving anything.
    if (!consent.checked) { consentError.hidden = false; consent.focus(); return; }
    consentError.hidden = true;
    SM.store.set('consent', true);
    SM.store.set('prefs', {
      order: state.order, weights: state.weights, budget: state.budget,
      beds: state.beds, destination: state.destination, savedAt: new Date().toISOString()
    });
    window.location.href = 'results.html';
  });
  consent.addEventListener('change', function () { if (consent.checked) consentError.hidden = true; });

  // Enter key shouldn't submit the form
  $('#quizForm').addEventListener('submit', (e) => e.preventDefault());

  renderRankList();
  showStep(1, false);
})();
