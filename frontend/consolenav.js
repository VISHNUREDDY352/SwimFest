/* ============================================================
   SwimFest — shared console sidebar   consolenav.js
   Pages shared between roles (player list, heat generation, live
   results, race control, create a meet) call SwimNav.applySuperAdmin()
   so a super admin keeps the Super Admin Console sidebar on them
   instead of the Admin or organizer one.
   ============================================================ */
'use strict';

(function () {
  function link(href, icon, label, active, extra) {
    return `<a href="${href}" class="ac-side-link${extra ? ' ' + extra : ''}${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}><i class="fas fa-${icon}"></i> ${label}</a>`;
  }

  // Mirrors the sidebar on superadmin.html; `active` is the current page file name
  function superAdminNav(active) {
    const is = page => page === active;
    return `
      <nav class="ac-side-group" aria-label="Console">
        ${link('superadmin.html#dashboard', 'clipboard-check', 'Approvals')}
        ${link('superadmin.html#meets', 'trophy', 'All meets')}
        ${link('superadmin.html#academies', 'building', 'Academies &amp; coaches')}
        ${link('superadmin.html#financials', 'indian-rupee-sign', 'Financials')}
      </nav>
      <nav class="ac-side-group" aria-label="Tools">
        <div class="ac-side-label">Tools</div>
        ${link('playerlist.html', 'list-check', 'Master player list', is('playerlist.html'))}
        ${link('heatgen.html', 'bolt', 'Heat generation', is('heatgen.html'))}
        ${link('orgracecontrol.html', 'flag-checkered', 'Race control', is('orgracecontrol.html'))}
        ${link('results.html', 'broadcast-tower', 'Live results', is('results.html'))}
        ${link('orgcreate.html', 'plus', 'Create meet', is('orgcreate.html'))}
        ${link('academy.html', 'building-columns', 'Academy directory')}
        ${link('admin.html', 'cogs', 'Admin console')}
        ${link('orgdashboard.html', 'user-tie', 'Organizer dashboard')}
        ${link('saoverride.html', 'unlock-alt', 'Universal override', false, 'warn')}
      </nav>`;
  }

  // ids: { nav, brand, brandSub, userLink, name, initials, role } — element ids on the page
  function applySuperAdmin(ids, active) {
    const $ = id => (id ? document.getElementById(id) : null);
    const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
    if (!session || session.role !== 'super_admin') return false;
    const nav = $(ids.nav);
    if (nav) nav.innerHTML = superAdminNav(active);
    if ($(ids.brand)) $(ids.brand).setAttribute('href', 'superadmin.html');
    if ($(ids.brandSub)) $(ids.brandSub).textContent = 'Super Admin Console';
    if ($(ids.userLink)) { $(ids.userLink).setAttribute('href', 'saprofile.html'); $(ids.userLink).title = 'Your profile'; }
    const name = session.name || session.email || 'Super Admin';
    if ($(ids.name)) $(ids.name).textContent = name;
    if ($(ids.initials)) $(ids.initials).textContent = String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA';
    if ($(ids.role)) $(ids.role).textContent = 'Super Admin';
    return true;
  }

  window.SwimNav = { superAdminNav, applySuperAdmin };
})();
