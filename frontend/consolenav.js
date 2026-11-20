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
        ${link('superadmin.html#financials', 'indian-rupee-sign', 'Financials')}
        ${link('superadmin.html#history', 'history', 'History')}
        ${link('superadmin.html#logs', 'right-to-bracket', 'Logs')}
        ${link('saprofile.html', 'user', 'Profile', is('saprofile.html'))}
      </nav>
      <nav class="ac-side-group" aria-label="Run a meet">
        <div class="ac-side-label">Run a meet</div>
        ${link('superadmin.html#playerlist', 'list-check', 'Player list', is('playerlist.html'))}
        ${link('superadmin.html#heatgen', 'bolt', 'Heat generation', is('heatgen.html'))}
        ${link('superadmin.html#racecontrol', 'flag-checkered', 'Race control', is('orgracecontrol.html'))}
        ${link('superadmin.html#results', 'broadcast-tower', 'Live results', is('results.html'))}
      </nav>
      <details class="ac-side-more"${is('orgcreate.html') ? ' open' : ''}>
        <summary class="ac-side-label">More</summary>
        <nav class="ac-side-group" aria-label="More">
          ${link('superadmin.html#createmeet', 'plus', 'Create meet', is('orgcreate.html'))}
          ${link('academy.html', 'building-columns', 'Academies &amp; coaches')}
          ${link('admin.html', 'cogs', 'Admin console')}
          ${link('superadmin.html#organizer', 'user-tie', 'Organizer view')}
          ${link('superadmin.html#override', 'unlock-alt', 'Universal override', false, 'warn')}
        </nav>
      </details>`;
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
    const mobilebar = document.querySelector('.ac-mobilebar');
    if (mobilebar && active !== 'saprofile.html' && !mobilebar.querySelector('.sa-profile-mobile-link')) {
      const pLink = document.createElement('a');
      pLink.className = 'ac-icon-btn sa-profile-mobile-link';
      pLink.href = 'saprofile.html';
      pLink.title = 'Your profile';
      pLink.setAttribute('aria-label', 'Profile');
      pLink.style.marginLeft = 'auto';
      pLink.innerHTML = '<i class="fas fa-user-circle"></i>';
      mobilebar.appendChild(pLink);
    }
    return true;
  }

  // ── Meet pickers (player list, live results, race control, heat generation) ──
  // "2026-11-12" → 12 Nov 2026, read as a calendar date (no time-zone shift)
  function day(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  // Short ranges so meet pickers fit on a phone:
  // "6–14 Jan 2027", "30 Oct – 3 Nov 2026", "28 Dec 2026 – 2 Jan 2027", "20 Jun 2026"
  function dates(start, end) {
    const parse = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
    const a = parse(start), b = parse(end) || a;
    if (!a) return '';
    const f = (d, o) => d.toLocaleDateString('en-IN', o);
    const full = d => f(d, { day: 'numeric', month: 'short', year: 'numeric' });
    if (+a === +b) return full(a);
    if (a.getFullYear() !== b.getFullYear()) return `${full(a)} – ${full(b)}`;
    if (a.getMonth() !== b.getMonth()) return `${f(a, { day: 'numeric', month: 'short' })} – ${full(b)}`;
    return `${a.getDate()}–${full(b)}`;
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
