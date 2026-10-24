/* ============================================================
   SwimFest — Page Access Guard   guard.js
   Standalone, dependency-free role guard for restricted pages.

   Usage — place in <head> BEFORE the page content loads:
     <script src="guard.js" data-roles="super_admin"></script>
     <script src="guard.js" data-roles="super_admin,event_manager"></script>

   It reads the session synchronously from localStorage/sessionStorage
   (key 'swimfest_session', same as auth.js) and redirects to login
   if the visitor is not logged in or lacks an allowed role.

   NOTE: This is a UI-level guard. True enforcement lives in the
   Supabase RLS policies on the data. A client guard only hides the
   page and blocks casual access.
   ============================================================ */
(function () {
  'use strict';

  var SESSION_KEY = 'swimfest_session';

  // Which roles may view this page (from the <script data-roles="...">)
  var current = document.currentScript;
  var rolesAttr = current ? (current.getAttribute('data-roles') || '') : '';
  var allowed = rolesAttr.split(',').map(function (r) { return r.trim(); }).filter(Boolean);

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function redirect(reason) {
    var here = window.location.pathname.split('/').pop() + window.location.search;
    window.location.replace('login.html?returnTo=' + encodeURIComponent(here) + '&reason=' + reason);
  }

  var session = readSession();

  // A valid session must at least identify a role (real logins also
  // carry userId; demo-mode sessions carry role only).
  if (!session || !session.role) {
    redirect('login_required');
    return;
  }

  if (allowed.length && allowed.indexOf(session.role) === -1) {
    redirect('wrong_role');
    return;
  }
  // Access granted. Keep the page hidden behind a small spinner until it
  // is ready, so a refresh never shows the half-built layout (blank icons,
  // empty boxes). Pages with data-wait-ready also wait for window.SwimReady().
  var root = document.documentElement;
  var waitForPage = current && current.hasAttribute('data-wait-ready');
  root.classList.add('sf-wait');
  var style = document.createElement('style');
  style.textContent =
    'html.sf-wait body{visibility:hidden}' +
    'html.sf-wait::before{content:"";position:fixed;top:50%;left:50%;width:36px;height:36px;margin:-18px 0 0 -18px;' +
    'border:3px solid #cbd5e1;border-top-color:#0077b6;border-radius:50%;animation:sf-spin .8s linear infinite;z-index:2147483647}' +
    '@keyframes sf-spin{to{transform:rotate(360deg)}}' +
    'html.sf-show body{animation:sf-in .18s ease-out}' +
    '@keyframes sf-in{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(style);

  var pageReady = !waitForPage, loaded = false, shown = false;
  function reveal() {
    if (shown) return;
    shown = true;
    root.classList.remove('sf-wait');
    root.classList.add('sf-show');
  }
  function maybeReveal() { if (pageReady && loaded) reveal(); }

  window.SwimReady = function () { pageReady = true; maybeReveal(); };
  // Text and layout are ready at DOMContentLoaded; don't wait for images too.
  // Give the fonts and icons a moment to arrive, but a slow font server
  // must never hold the page back for more than 0.6 s.
  document.addEventListener('DOMContentLoaded', function () {
    var fontsIn = function () { loaded = true; maybeReveal(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fontsIn);
    else fontsIn();
    setTimeout(fontsIn, 600);
  });
  // Never keep anyone staring at a spinner: show the page after 3 s regardless
  setTimeout(reveal, 3000);

  // Instant switching between console pages: Chrome starts loading a page
  // while the pointer rests on its link, so the click shows it at once.
  // Browsers without speculation rules simply ignore this.
  if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    var rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({
      prerender: [{
        where: { and: [
          { href_matches: '/*.html' },
          { not: { href_matches: '/login.html*' } },
          { not: { selector_matches: '[target=_blank], [download]' } },
        ] },
        eagerness: 'moderate',
      }],
    });
    document.head.appendChild(rules);
  }
})();
