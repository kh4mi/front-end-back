/* signup.js — demo Sign up / Log in.
   Accounts are saved in this browser's localStorage only (nothing is sent anywhere):
     sm.accounts  { "<email>": { name, email, hash, created } }
     sm.session   { name, email }  = who is logged in
   The password is stored as a SHA-256 hash, not as typed. This is a prototype, not real security:
   anyone using the same browser can read localStorage. */
(function () {
  'use strict';
  let mode = 'signup';
  const $ = (id) => document.getElementById(id);

  function paint() {
    const signup = mode === 'signup';
    $('authTitle').textContent = signup ? 'Sign up' : 'Log in';
    $('switchMode').textContent = signup ? 'Log in' : 'Sign up';
    $('submitBtn').textContent = signup ? 'Create Account' : 'Log in';
    $('nameField').hidden = !signup;
    $('agreeField').hidden = !signup;
    $('fullName').required = signup;
    $('agree').required = signup;
    $('password').autocomplete = signup ? 'new-password' : 'current-password';
  }

  $('switchMode').addEventListener('click', function () {
    mode = mode === 'signup' ? 'login' : 'signup';
    showError('');
    paint();
  });

  function showError(msg) {
    $('authError').textContent = msg;
    $('authError').hidden = !msg;
  }

  const read = (key, fallback) => {
    try { const v = window.localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  };
  const write = (key, value) => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  };

  async function hash(text) {
    if (window.crypto && crypto.subtle) {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // crypto.subtle only works over http(s), not when the page is opened straight from disk
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'fnv-' + (h >>> 0).toString(16);
  }

  // Things a guest saved before signing up move into their new account
  const GUEST_KEYS = ['prefs', 'consent', 'savedSuburbs', 'savedListings'];
  function copyGuestData(email) {
    GUEST_KEYS.forEach(function (k) {
      try {
        const v = window.localStorage.getItem('sm.' + k);
        if (v !== null) window.localStorage.setItem('sm.user.' + email + '.' + k, v);
      } catch (e) { /* ignore */ }
    });
  }

  // Email format check. The browser's own check accepts addresses like "name@site",
  // so this also asks for a dot and at least 2 letters after the @ (e.g. name@uq.edu.au).
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
  const email = $('email');
  const emailError = $('emailError');

  function checkEmail() {
    const v = email.value.trim();
    const msg = !v ? 'Enter your email address.'
      : !EMAIL_RE.test(v) ? 'Enter a valid email address, like name@example.com.'
      : '';
    emailError.textContent = msg;
    emailError.hidden = !msg;
    email.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  // Check when they leave the field, then re-check as they fix it.
  email.addEventListener('blur', function () { if (email.value.trim()) checkEmail(); });
  email.addEventListener('input', function () { if (!emailError.hidden) checkEmail(); });

  // The browser checks the other required fields first; this only runs if they're valid.
  $('authForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    showError('');
    if (!checkEmail()) { email.focus(); return; }
    const key = email.value.trim().toLowerCase();
    const accounts = read('sm.accounts', {});
    const pwHash = await hash(key + ':' + $('password').value); // email as salt

    if (mode === 'signup') {
      if (accounts[key]) { showError('There is already an account with that email. Log in instead.'); return; }
      const name = $('fullName').value.trim();
      accounts[key] = { name: name, email: key, hash: pwHash, created: new Date().toISOString() };
      if (!write('sm.accounts', accounts)) { showError('This browser blocked saving. Try a normal (not private) window.'); return; }
      copyGuestData(key);
      write('sm.session', { name: name, email: key });
    } else {
      const acc = accounts[key];
      if (!acc) { showError('No account with that email on this browser. Sign up first.'); return; }
      if (acc.demo) { showError('That is the demo account. Use "Try with a demo account" below instead.'); return; }
      if (acc.hash !== pwHash) { showError('That password is incorrect.'); return; }
      write('sm.session', { name: acc.name, email: key });
    }
    window.location.href = 'index.html';
  });

  // "Try with a demo account": logs in as a shared demo user, creating it the first time
  const DEMO = { name: 'Demo User', email: 'demo@suburb.ly' };
  $('demoBtn').addEventListener('click', function () {
    const accounts = read('sm.accounts', {});
    if (!accounts[DEMO.email]) {
      accounts[DEMO.email] = { name: DEMO.name, email: DEMO.email, hash: null, demo: true, created: new Date().toISOString() };
      write('sm.accounts', accounts);
    }
    write('sm.session', DEMO);
    window.location.href = 'index.html';
  });

  // Already logged in: say so
  const session = read('sm.session', null);
  if (session) {
    const note = document.createElement('p');
    note.className = 'notice notice--info';
    note.textContent = 'You are logged in as ' + session.email + '. Log out from the top of the page to switch accounts.';
    $('authForm').before(note);
  }

  paint();
})();
