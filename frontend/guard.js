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
  // Access granted — do nothing, let the page render.
})();
