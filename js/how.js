/* how.js — consent checkbox, continue button, and "delete my data" on the How it works page */
(function () {
  'use strict';
  const consent = document.getElementById('consent');
  const cont = document.getElementById('continueBtn');
  const msg = document.getElementById('privacyMsg');

  consent.checked = !!SM.store.get('consent', false);
  cont.disabled = !consent.checked;

  consent.addEventListener('change', function () {
    cont.disabled = !consent.checked;
    if (consent.checked) {
      SM.store.set('consent', true);
      msg.textContent = '';
    } else {
      // Withdrawing consent removes the saved quiz answers.
      SM.store.set('consent', false);
      SM.store.remove('prefs');
      msg.textContent = 'Consent withdrawn. Your saved quiz answers were removed from this browser.';
    }
  });

  cont.addEventListener('click', function () { window.location.href = 'quiz.html'; });

  document.getElementById('clearBtn').addEventListener('click', function () {
    ['prefs', 'consent', 'savedSuburbs', 'savedListings'].forEach((k) => SM.store.remove(k));
    consent.checked = false;
    cont.disabled = true;
    msg.textContent = 'Done. Your saved answers, saved suburbs and saved listings were deleted from this browser.';
  });

  // If the page was opened with #privacy, make sure the section is in view after layout.
  if (window.location.hash === '#privacy') {
    const el = document.getElementById('privacy');
    if (el) el.scrollIntoView();
  }
})();
