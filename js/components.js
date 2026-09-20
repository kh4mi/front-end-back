/* ==========================================================================
   components.js — reusable navbar and footer

   Usage on any page:
     <site-header active="browse"></site-header>   ...page...   <site-footer></site-footer>
   `active` can be: how | browse | rentals  (leave it out on other pages)

   To change the site name, nav links or footer text, edit them here once
   and every page updates.
   ========================================================================== */
(function () {
  'use strict';

  const SITE_NAME = 'suburb.ly';

  const NAV = [
    { id: 'how',     label: 'How it works',   href: 'how-it-works.html' },
    { id: 'browse',  label: 'Browse suburbs', href: 'results.html' },
    { id: 'rentals', label: 'Find a Rental',  href: 'rentals.html' },
    { id: 'saved', label: 'Saved Suburbs', href: 'under-construction.html'}
  ];

  const LOGO_ICON =
    '<svg viewBox="0 0 24 24" fill="#FF5757" stroke="#000" stroke-width="2" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5" fill="#fff"/></svg>';

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const active = this.getAttribute('active');
      const links = NAV.map(function (item) {
        return '<a href="' + item.href + '"' + (item.id === active ? ' aria-current="page"' : '') + '>' + item.label + '</a>';
      }).join('');
      this.innerHTML =
        '<a class="skip-link" href="#main">Skip to main content</a>' +
        '<div class="site-header">' +
          '<a class="site-header__logo" href="index.html" aria-label="' + SITE_NAME + ' home">' + LOGO_ICON + SITE_NAME + '</a>' +
          '<nav class="site-nav" aria-label="Main">' + links + '</nav>' +
          '<a class="btn" href="signup.html">Sign up</a>' +
        '</div>';
    }
  }

  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const links = NAV.map(function (item) {
        return '<li><a href="' + item.href + '">' + item.label + '</a></li>';
      }).join('');
      this.innerHTML =
        '<footer class="site-footer">' +
          '<div class="site-footer__grid">' +
            '<div>' +
              '<p class="site-footer__brand">' + SITE_NAME + '</p>' +
              '<p>Helping new arrivals choose a Brisbane suburb that fits their life, before they start hunting for a rental.</p>' +
            '</div>' +
            '<div><h2>Explore</h2><ul>' + links + '</ul></div>' +
            '<div><h2>About</h2><ul>' +
              '<li><a href="how-it-works.html#privacy">Privacy and your data</a></li>' +
              '<li><a href="references.html">References and credits</a></li>' +
              '<li><a href="signup.html">Sign up</a></li>' +
            '</ul></div>' +
          '</div>' +
          '<p class="site-footer__small">Student prototype by the front end back team for DECO1800, University of Queensland. ' +
            'Scores are a guide only. Contains data from Brisbane City Council Open Data (see <a href="references.html">references</a>).</p>' +
        '</footer>';
    }
  }

  customElements.define('site-header', SiteHeader);
  customElements.define('site-footer', SiteFooter);
})();
