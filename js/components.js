/* ==========================================================================
   components.js — reusable navbar and footer

   Usage on any page:
     <site-header active="browse"></site-header>   ...page...   <site-footer></site-footer>
   `active` can be: about | how | browse | rentals | saved  (leave it out on other pages)

   To change the site name, nav links or footer text, edit them here once
   and every page updates.
   ========================================================================== */
(function () {
  'use strict';

  const SITE_NAME = 'suburb.ly';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // An item with `children` is a menu heading (not a link) that opens a small menu on hover, focus or click.
  const NAV = [
    { id: 'about-menu', label: 'About', children: [
      { id: 'about', label: 'About us',     href: 'about.html' },
      { id: 'how',   label: 'How it works', href: 'how-it-works.html' }
    ] },
    { id: 'browse',  label: 'Browse suburbs', href: 'results.html' },
    { id: 'rentals', label: 'Find a Rental',  href: 'rentals.html' },
    { id: 'saved',   label: 'Saved',          href: 'saved.html' }
  ];
  // Every page link in order, for the footer
  const PAGES = NAV.reduce((all, item) => all.concat(item.children || [item]), []);

  // Right arrow (SVG Repo, "right arrow backup 2"); CSS turns it to point down when the menu is open
  const MENU_ARROW =
    '<svg class="nav-menu__arrow" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">' +
    '<path d="M256 120.768L306.432 64 768 512l-461.568 448L256 903.232 659.072 512z" fill="currentColor"/></svg>';

  // Hamburger (SVG Repo, "hamburger"), redrawn as three lines so CSS can fold them into an X when the menu is open
  const BURGER_ICON =
    '<svg class="nav-toggle__icon" viewBox="0 -0.5 25 25" aria-hidden="true" focusable="false">' +
    '<line x1="5.5" y1="8.5" x2="19.5" y2="8.5"/><line x1="5.5" y1="12.5" x2="19.5" y2="12.5"/><line x1="5.5" y1="16.5" x2="19.5" y2="16.5"/></svg>';

  const LOGO_ICON =
    '<svg viewBox="0 0 24 24" fill="#FF5757" stroke="#000" stroke-width="2" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5" fill="#fff"/></svg>';

  // Demo login (js/signup.js): who is logged in on this browser, or null
  function currentUser() {
    try { return JSON.parse(window.localStorage.getItem('sm.session') || 'null'); } catch (e) { return null; }
  }

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const user = currentUser();
      const account = user
        ? '<div class="site-header__account"><span class="site-header__user">Hi, ' + esc(user.name.split(' ')[0]) + '</span>' +
            '<button class="btn" type="button" data-logout>Log out</button></div>'
        : '<a class="btn" href="signup.html">Sign up</a>';
      const active = this.getAttribute('active');
      const link = (item) => '<a href="' + item.href + '"' + (item.id === active ? ' aria-current="page"' : '') + '>' + item.label + '</a>';
      const links = NAV.map(function (item) {
        if (!item.children) return link(item);
        const current = item.children.some((c) => c.id === active);
        return (
          '<div class="nav-menu' + (current ? ' nav-menu--current' : '') + '">' +
            '<button class="nav-menu__toggle" type="button" aria-expanded="false" aria-controls="' + item.id + '">' +
              item.label + MENU_ARROW + '</button>' +
            '<div class="nav-menu__list" id="' + item.id + '">' + item.children.map(link).join('') + '</div>' +
          '</div>'
        );
      }).join('');
      this.innerHTML =
        '<a class="skip-link" href="#main">Skip to main content</a>' +
        '<div class="site-header">' +
          '<a class="site-header__logo" href="index.html" aria-label="' + SITE_NAME + ' home">' + LOGO_ICON + SITE_NAME + '</a>' +
          '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteMenu" aria-label="Menu">' + BURGER_ICON + '</button>' +
          '<div class="site-header__menu" id="siteMenu">' +
            '<nav class="site-nav" aria-label="Main">' + links + '</nav>' +
            account +
          '</div>' +
        '</div>';
      // Mobile: the hamburger shows and hides the links (on wider screens the button is hidden and the links always show)
      const header = this.querySelector('.site-header');
      const burger = this.querySelector('.nav-toggle');
      const setMenu = (open) => { header.classList.toggle('is-open', open); burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Close menu' : 'Menu'); };
      burger.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
      header.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
      // Menu headings: hover opens them (CSS); a click, Enter or Space toggles them; Esc, clicking elsewhere or tabbing away closes
      this.querySelectorAll('.nav-menu').forEach(function (menu) {
        const toggle = menu.querySelector('.nav-menu__toggle');
        const setOpen = (open) => { menu.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); };
        toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
        menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); toggle.focus(); } });
        document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setOpen(false); });
        menu.addEventListener('focusout', (e) => { if (!menu.contains(e.relatedTarget)) setOpen(false); });
      });
      // Hide the navbar while scrolling down the page, bring it back as soon as the visitor scrolls up
      const bar = this;
      let lastY = window.scrollY;
      window.addEventListener('scroll', function () {
        const y = window.scrollY;
        if (Math.abs(y - lastY) < 6) return; // ignore tiny wobbles (e.g. trackpad bounce)
        const hide = y > lastY && y > bar.offsetHeight && !header.classList.contains('is-open') && !bar.contains(document.activeElement);
        bar.classList.toggle('is-hidden', hide);
        document.documentElement.classList.toggle('nav-hidden', hide);
        lastY = y;
      }, { passive: true });
      bar.addEventListener('focusin', () => { bar.classList.remove('is-hidden'); document.documentElement.classList.remove('nav-hidden'); }); // keyboard users always see where focus is

      const logout = this.querySelector('[data-logout]');
      if (logout) logout.addEventListener('click', function () {
        try { window.localStorage.removeItem('sm.session'); } catch (e) { /* ignore */ }
        window.location.reload();
      });
    }
  }

  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const links = PAGES.map(function (item) {
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
