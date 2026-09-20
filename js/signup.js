/* signup.js — toggles Sign up / Log in and sends the visitor to the "under construction" page.
   No data is stored or sent: accounts are not built in this prototype. */
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
    paint();
  });

  // The browser checks the required fields first; this only runs if they're valid.
  $('authForm').addEventListener('submit', function (e) {
    e.preventDefault();
    window.location.href = 'under-construction.html';
  });

  paint();
})();
