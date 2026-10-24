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
  // Tools link into the console (superadmin.html#<tool>), where they open in a frame
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
        ${link('superadmin.html#playerlist', 'list-check', 'Master player list', is('playerlist.html'))}
        ${link('superadmin.html#heatgen', 'bolt', 'Heat generation', is('heatgen.html'))}
        ${link('superadmin.html#racecontrol', 'flag-checkered', 'Race control', is('orgracecontrol.html'))}
        ${link('superadmin.html#results', 'broadcast-tower', 'Live results', is('results.html'))}
        ${link('superadmin.html#createmeet', 'plus', 'Create meet', is('orgcreate.html'))}
        ${link('academy.html', 'building-columns', 'Academy directory')}
        ${link('admin.html', 'cogs', 'Admin console')}
        ${link('superadmin.html#organizer', 'user-tie', 'Organizer dashboard')}
        ${link('superadmin.html#override', 'unlock-alt', 'Universal override', false, 'warn')}
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

  // ── Meet pickers (player list, live results, race control, heat generation) ──
  // "2026-11-12" → 12 Nov 2026, read as a calendar date (no time-zone shift)
  function day(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function dates(start, end) {
    if (!start) return '';
    return end && String(end).slice(0, 10) !== String(start).slice(0, 10) ? `${day(start)} – ${day(end)}` : day(start);
  }
  function todayIso() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  // Finished = completed, or its last day is before today
  function isFinished(t) {
    return t.status === 'COMPLETED' || String(t.end_date || t.start_date || '').slice(0, 10) < todayIso();
  }
  // Current & upcoming first (soonest first), then finished meets (most recent first)
  function sortMeets(meets) {
    const byStart = (a, b) => String(a.start_date || '').localeCompare(String(b.start_date || ''));
    const current = meets.filter(t => !isFinished(t)).sort(byStart);
    const finished = meets.filter(isFinished).sort((a, b) => byStart(b, a));
    return { current, finished };
  }
  function meetOptions(meets) {
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const opt = t => {
      const when = dates(t.start_date, t.end_date);
      return `<option value="${esc(t.tournament_id)}">${esc(t.title)}${when ? ' · ' + esc(when) : ''}</option>`;
    };
    const { current, finished } = sortMeets(meets);
    return (current.length ? `<optgroup label="Current & upcoming">${current.map(opt).join('')}</optgroup>` : '')
      + (finished.length ? `<optgroup label="Finished">${finished.map(opt).join('')}</optgroup>` : '');
  }
  // ?t=<id> wins; else the first current meet matching `prefer`; else the nearest current meet
  function pickMeet(meets, prefer) {
    const wanted = new URLSearchParams(location.search).get('t');
    const { current, finished } = sortMeets(meets);
    return meets.find(t => t.tournament_id === wanted)
      || (prefer && current.find(prefer))
      || current[0] || finished[0] || null;
  }

  window.SwimNav = { superAdminNav, applySuperAdmin, meetOptions, pickMeet, dates, day };
})();
