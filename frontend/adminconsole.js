/* ============================================================
   SwimFest — Admin Console (Admin) JS   adminconsole.js
   One script for admin.html: my meets, approval queues,
   add academy / coach, sidebar navigation.
   ============================================================ */
'use strict';

// ── Utilities ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg, type = 'info') {
  const existing = document.querySelector('.admin-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'warn' ? 'exclamation-triangle' : 'info-circle';
  toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}
window.showToast = showToast;

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="ac-empty-cell">
    <div class="ac-empty-icon"><i class="fas fa-check"></i></div>
    <div style="font-weight:700;color:var(--ac-ink);margin-bottom:4px;">You're all caught up</div>
    ${escHtml(msg)}
  </td></tr>`;
}

function fmtDates(s, e) {
  const f = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
  return s ? `${f(s)}${e ? ' – ' + f(e) : ''}` : '—';
}

// ── My meets (platform / Option A meets) ──────────────────────
let TOURNAMENTS = [];
let MEET_FILTER = 'all';

async function loadPipeline() {
  if (!window.sb) { $('pipelineBody').innerHTML = '<div class="ac-empty">Database not connected.</div>'; return; }

  // EM is the internal admin: this list shows the platform's own
  // (internal) meets — any meet not created by an organizer account.
  // Organizer meets live on the Organizer dashboard.
  const [{ data: all, error }, { data: orgs }] = await Promise.all([
    window.sb.from('tournaments')
      .select('tournament_id, title, venue_name, city, start_date, end_date, gateway_option, status, created_by')
      .order('start_date', { ascending: false }),
    window.sb.from('organizer_directory').select('owner_id'),
  ]);
  const organizerIds = new Set((orgs || []).map(o => o.owner_id));
  const data = (all || []).filter(t => !organizerIds.has(t.created_by));

  if (error) {
    console.error('[SwimFest] pipeline:', error.message);
    $('pipelineBody').innerHTML = `<div class="ac-empty">Could not load meets: ${escHtml(error.message)}</div>`;
    return;
  }

  // Entry counts per tournament
  const counts = {};
  try {
    const { data: entries } = await window.sb.from('event_entries').select('tournament_id');
    (entries || []).forEach(e => { counts[e.tournament_id] = (counts[e.tournament_id] || 0) + 1; });
  } catch (_) {}

  const rows = data || [];
  TOURNAMENTS = rows.map(t => ({
    id: t.tournament_id,
    title: t.title,
    venue: `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`,
    dates: fmtDates(t.start_date, t.end_date),
    status: t.status,
    entries: counts[t.tournament_id] || 0,
  }));

  const totalEntries = rows.reduce((s, t) => s + (counts[t.tournament_id] || 0), 0);
  $('emStatMeets').textContent = rows.length;
  $('emStatEntries').textContent = totalEntries.toLocaleString('en-IN');
  $('acMeetsCount').textContent = rows.length;

  renderPipeline();
}

const MEET_GROUP = {
  PENDING_APPROVAL: 'active', PUBLISHED: 'active', CLOSED: 'active', LOCKED: 'active', CLOSURE_REQUESTED: 'active',
  REJECTED_DRAFT: 'attention', DRAFT: 'attention',
  COMPLETED: 'done',
};

const STATUS_PILL = {
  PENDING_APPROVAL: { cls: 'ac-pill-wait',  label: 'Pending approval' },
  PUBLISHED:        { cls: 'ac-pill-live',  label: 'Published' },
  CLOSED:           { cls: 'ac-pill-wait',  label: 'Registration closed' },
  LOCKED:           { cls: 'ac-pill-live',  label: 'Heats locked' },
  CLOSURE_REQUESTED:{ cls: 'ac-pill-wait',  label: 'Closure requested' },
  COMPLETED:        { cls: 'ac-pill-done',  label: 'Completed' },
  REJECTED_DRAFT:   { cls: 'ac-pill-bad',   label: 'Rejected' },
  DRAFT:            { cls: 'ac-pill-draft', label: 'Draft' },
};

// Progress track: Approved → Entries → Heats → Live → Completed.
// done = steps finished, now = current step index (-1 none), bad = rejected
function trackState(t) {
  switch (t.status) {
    case 'PENDING_APPROVAL': return { done: 0, now: 0 };
    case 'PUBLISHED':        return t.entries > 0 ? { done: 2, now: 2 } : { done: 1, now: 1 };
    case 'CLOSED':           return { done: 2, now: 2 };
    case 'LOCKED':           return { done: 3, now: 3 };
    case 'CLOSURE_REQUESTED':return { done: 4, now: 4 };
    case 'COMPLETED':        return { done: 5, now: -1 };
    case 'REJECTED_DRAFT':   return { done: 0, now: -1, bad: true };
    default:                 return { done: 0, now: -1 };
  }
}

function trackHtml(t) {
  const st = trackState(t);
  const steps = ['Approved', 'Entries', 'Heats', 'Live', 'Completed'];
  const cls = i => st.bad && i === 0 ? 'bad' : i < st.done ? 'done' : i === st.now ? 'now' : '';
  return `<div class="ac-track" aria-label="Progress">
    <div class="ac-track-bars">${steps.map((_, i) => `<span class="${cls(i)}"></span>`).join('')}</div>
    <div class="ac-track-labels">${steps.map((s, i) => `<span class="${cls(i)}">${s}</span>`).join('')}</div>
  </div>`;
}

// One clear next step per meet, plus a "more" menu for the rest
function actionsHtml(t) {
  const title = encodeURIComponent(t.title || '');
  const more = (links) => links.length ? `
    <details class="ac-more">
      <summary aria-label="More actions"><i class="fas fa-ellipsis"></i></summary>
      <div class="ac-more-menu">${links.map(l => `<a href="${l.href}"><i class="fas fa-${l.icon}"></i> ${l.label}</a>`).join('')}</div>
    </details>` : '';
  const id         = encodeURIComponent(t.id);
  const publicPage = { href: `event.html?id=${id}`, icon: 'globe', label: 'Public event page' };
  const roster     = { href: `playerlist.html?t=${id}`, icon: 'list-check', label: 'Player list' };
  const heats      = { href: `heatgen.html?t=${id}`, icon: 'bolt', label: 'Heat generation' };
  const results    = { href: `results.html?t=${id}`, icon: 'broadcast-tower', label: 'Live results' };
  const sheets     = { href: `heatsheets.html?tournament=${title}`, icon: 'file-lines', label: 'Heat sheets' };

  switch (t.status) {
    case 'PENDING_APPROVAL':
      return `<span class="ac-cta-note">Waiting for super admin approval</span>`;
    case 'CLOSURE_REQUESTED':
      return `<span class="ac-cta-note">Closure waiting for super admin sign-off</span>` + more([results, sheets]);
    case 'PUBLISHED':
    case 'CLOSED':
      // Heats can only be drawn once the player list is locked
      return `<a href="playerlist.html?t=${id}" class="ac-cta ac-cta-primary"><i class="fas fa-list-check"></i> Check &amp; lock entries</a>` + more([results, publicPage]);
    case 'LOCKED':
      return `<a href="orgracecontrol.html?t=${id}" class="ac-cta ac-cta-primary"><i class="fas fa-flag-checkered"></i> Race control</a>` + more([heats, results, sheets, roster]);
    case 'COMPLETED':
      return `<a href="heatsheets.html?tournament=${title}" class="ac-cta ac-cta-ghost"><i class="fas fa-box-archive"></i> View archive</a>` + more([results, publicPage]);
    case 'REJECTED_DRAFT':
      return `<a href="orgcreate.html?id=${id}" class="ac-cta ac-cta-primary"><i class="fas fa-pen"></i> Fix and resend</a>`;
    default:
      return `<a href="orgcreate.html?id=${id}" class="ac-cta ac-cta-ghost"><i class="fas fa-pen"></i> Continue editing</a>`;
  }
}

function renderPipeline() {
  const body = $('pipelineBody');
  if (!TOURNAMENTS.length) {
    body.innerHTML = '<div class="ac-empty">No internal meets yet. Use <strong>Add meet</strong> to create one.</div>';
    return;
  }
  const list = MEET_FILTER === 'all' ? TOURNAMENTS : TOURNAMENTS.filter(t => (MEET_GROUP[t.status] || 'attention') === MEET_FILTER);
  if (!list.length) {
    body.innerHTML = '<div class="ac-empty">No meets in this view.</div>';
    return;
  }
  body.innerHTML = list.map(t => {
    const pill = STATUS_PILL[t.status] || STATUS_PILL.DRAFT;
    return `
    <article class="ac-meet">
      <div class="ac-meet-info">
        <div class="ac-meet-top">
          <h3 class="ac-meet-title">${escHtml(t.title)}</h3>
          <span class="ac-pill ${pill.cls}">${pill.label}</span>
        </div>
        <span class="ac-meet-meta">${escHtml(t.dates)}${t.venue ? ' · ' + escHtml(t.venue) : ''}</span>
        <span class="ac-meet-meta-2">${t.entries} ${t.entries === 1 ? 'entry' : 'entries'} · Option A online gateway</span>
      </div>
      ${trackHtml(t)}
      <div class="ac-meet-actions">${actionsHtml(t)}</div>
    </article>`;
  }).join('');
}

// ── Approval queues ───────────────────────────────────────────
let PENDING_SWIMMERS  = [];
let PENDING_COACHES   = [];
let PENDING_ACADEMIES = [];
let PENDING_EVENTS    = [];

function switchAdminTab(tabId, btnEl) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));

  const target = $(tabId);
  if (target) target.classList.add('active');
  if (btnEl) btnEl.classList.add('active');
}
window.switchAdminTab = switchAdminTab;

async function writeAudit(actionType, entity, entityId, notes) {
  if (!window.sb) return;
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  try {
    await window.sb.from('system_audit_logs').insert({
      admin_id: session ? session.userId : null,
      action_type: actionType,
      target_entity: entity,
      target_entity_id: String(entityId),
      notes,
    });
  } catch (e) {
    console.warn('[AdminConsole] audit error:', e.message);
  }
}

async function loadAllQueues() {
  if (!window.sb) {
    console.warn('[AdminConsole] Supabase client not ready');
    return;
  }

  const queryTerm = ($('adminConsoleSearch') ? $('adminConsoleSearch').value : '').toLowerCase().trim();

  // Helper check for pending statuses (captures PENDING_VERIFICATION, PENDING, pending, UNVERIFIED, null, empty)
  const isPending = (status) => {
    if (!status) return true;
    const st = String(status).toUpperCase();
    return st !== 'APPROVED_ACTIVE' && st !== 'APPROVED' && st !== 'REJECTED';
  };

  // 1. Load Pending Swimmers
  try {
    const swRes = await window.sb.from('swimmers').select('*');
    PENDING_SWIMMERS = (!swRes.error && swRes.data) ? swRes.data.filter(s => s && isPending(s.status)) : [];
  } catch (e) {
    console.warn('[AdminConsole] swimmers load error:', e.message);
    PENDING_SWIMMERS = [];
  }

  // 2. Load Pending Coaches
  try {
    const coRes = await window.sb.from('coaches').select('*');
    PENDING_COACHES = (!coRes.error && coRes.data) ? coRes.data.filter(c => c && isPending(c.status)) : [];
  } catch (e) {
    console.warn('[AdminConsole] coaches load error:', e.message);
    PENDING_COACHES = [];
  }

  // 3. Load Pending Academies
  try {
    const acRes = await window.sb.from('academies').select('*');
    PENDING_ACADEMIES = (!acRes.error && acRes.data) ? acRes.data.filter(a => a && isPending(a.status)) : [];
  } catch (e) {
    console.warn('[AdminConsole] academies load error:', e.message);
    PENDING_ACADEMIES = [];
  }

  // 4. Load Pending Events / Tournaments
  try {
    const evRes = await window.sb.from('tournaments').select('*');
    PENDING_EVENTS = (!evRes.error && evRes.data) ? evRes.data.filter(e => {
      if (!e) return false;
      const st = String(e.status || '').toUpperCase();
      return st === 'PENDING_APPROVAL' || st === 'PENDING' || st === 'DRAFT' || st === 'REJECTED_DRAFT';
    }) : [];
  } catch (e) {
    console.warn('[AdminConsole] events load error:', e.message);
    PENDING_EVENTS = [];
  }

  updateBadgesAndMetrics();
  renderSwimmers(queryTerm);
  renderCoaches(queryTerm);
  renderAcademies(queryTerm);
  renderEvents(queryTerm);
}
window.loadAllQueues = loadAllQueues;

function updateBadgesAndMetrics() {
  $('cntSwimmers').textContent  = PENDING_SWIMMERS.length;
  $('cntAcademies').textContent = PENDING_ACADEMIES.length;

  $('badgeSwimmers').textContent  = PENDING_SWIMMERS.length;
  $('badgeCoaches').textContent   = PENDING_COACHES.length;
  $('badgeAcademies').textContent = PENDING_ACADEMIES.length;
  $('badgeEvents').textContent    = PENDING_EVENTS.length;

  const total = PENDING_SWIMMERS.length + PENDING_COACHES.length + PENDING_ACADEMIES.length + PENDING_EVENTS.length;
  const totalEl = $('acTotalPending');
  totalEl.textContent = total;
  totalEl.classList.toggle('is-zero', total === 0);
}

function docLink(url) {
  return url
    ? `<a href="${escHtml(url)}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--ac-blue);"><i class="fas fa-file-alt"></i> View doc</a>`
    : `<span style="font-size:0.75rem;color:var(--ac-muted);">No document</span>`;
}

function actionCell(prefix, id, approveFn, rejectFn, name, approveLabel = 'Approve') {
  return `<td id="${prefix}-act-${id}">
    <button class="sa-btn-approve" onclick="${approveFn}('${id}', '${escHtml(name)}')"><i class="fas fa-check"></i> ${approveLabel}</button>
    <button class="sa-btn-reject" onclick="${rejectFn}('${id}', '${escHtml(name)}')"><i class="fas fa-times"></i> Reject</button>
  </td>`;
}

function renderSwimmers(q = '') {
  const tbody = $('swimmersTableBody');
  const filtered = PENDING_SWIMMERS.filter(s => {
    if (!q) return true;
    const txt = `${s.full_name || ''} ${s.parent_name || ''} ${s.parent_email || ''} ${s.parent_phone || ''} ${s.school_name || ''} ${s.sfi_serial_no || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = emptyRow(6, q ? 'No pending swimmers match your search.' : 'No new swimmers are waiting for approval.');
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr id="sw-row-${s.swimmer_id}">
      <td>
        <div style="font-weight:700;">${escHtml(s.full_name)}</div>
        <div style="font-size:0.72rem;color:var(--ac-muted);">Ref: ${escHtml(s.sfi_serial_no || 'SWM-' + s.swimmer_id)}</div>
      </td>
      <td>
        <div>${escHtml(s.gender || '—')}</div>
        <div style="font-size:0.75rem;color:var(--ac-muted);">${escHtml(s.date_of_birth ? 'DOB: ' + s.date_of_birth : '—')}</div>
      </td>
      <td><span class="grid-cat-pill">${escHtml(s.category || 'Open')}</span></td>
      <td>
        <div style="font-weight:600;">${escHtml(s.parent_name || '—')} (${escHtml(s.parent_phone || '—')})</div>
        <div style="font-size:0.72rem;color:var(--ac-blue);">${escHtml(s.parent_email || '—')}</div>
        <div style="font-size:0.72rem;color:var(--ac-muted);">${escHtml(s.school_name ? 'School: ' + s.school_name : '')}</div>
      </td>
      <td style="font-family:monospace;font-size:0.8rem;">${escHtml(s.sfi_serial_no || s.id_ref || '—')}</td>
      ${actionCell('sw', s.swimmer_id, 'approveSwimmer', 'rejectSwimmer', s.full_name)}
    </tr>`).join('');
}

function renderCoaches(q = '') {
  const tbody = $('coachesTableBody');
  const filtered = PENDING_COACHES.filter(c => {
    if (!q) return true;
    const txt = `${c.full_name || ''} ${c.designation || ''} ${c.created_by_email || ''} ${c.academy_name || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = emptyRow(6, q ? 'No pending coaches match your search.' : 'No coaches are waiting for approval.');
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr id="co-row-${c.coach_id}">
      <td><div style="font-weight:700;">${escHtml(c.full_name)}</div></td>
      <td>
        <div>${escHtml(c.designation || 'Coach')}</div>
        <div style="font-size:0.72rem;color:var(--ac-muted);">${escHtml(c.academy_name || 'Independent')}</div>
      </td>
      <td style="font-size:0.8rem;color:var(--ac-blue);">${escHtml(c.created_by_email || '—')}</td>
      <td style="font-size:0.8rem;">${escHtml(Array.isArray(c.certifications) ? c.certifications.join(', ') : c.certifications || '—')}</td>
      <td>${docLink(c.document_url)}</td>
      ${actionCell('co', c.coach_id, 'approveCoach', 'rejectCoach', c.full_name)}
    </tr>`).join('');
}

function renderAcademies(q = '') {
  const tbody = $('academiesTableBody');
  const filtered = PENDING_ACADEMIES.filter(a => {
    if (!q) return true;
    const txt = `${a.academy_name || ''} ${a.city || ''} ${a.created_by_email || ''} ${a.registration_no || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = emptyRow(6, q ? 'No pending academies match your search.' : 'No academies are waiting for approval.');
    return;
  }

  tbody.innerHTML = filtered.map(a => `
    <tr id="ac-row-${a.academy_id}">
      <td><div style="font-weight:700;">${escHtml(a.academy_name)}</div></td>
      <td>${escHtml(a.city || '—')}</td>
      <td style="font-size:0.8rem;color:var(--ac-blue);">${escHtml(a.created_by_email || '—')}</td>
      <td style="font-family:monospace;font-size:0.8rem;">${escHtml(a.registration_no || '—')}</td>
      <td>${docLink(a.document_url)}</td>
      ${actionCell('ac', a.academy_id, 'approveAcademy', 'rejectAcademy', a.academy_name)}
    </tr>`).join('');
}

function renderEvents(q = '') {
  const tbody = $('eventsTableBody');
  const filtered = PENDING_EVENTS.filter(e => {
    if (!q) return true;
    const txt = `${e.title || ''} ${e.host_organization || ''} ${e.city || ''} ${e.venue_name || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = emptyRow(5, q ? 'No pending events match your search.' : 'No organizer events are waiting for review.');
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr id="ev-row-${e.tournament_id}">
      <td>
        <div style="font-weight:700;">${escHtml(e.host_organization || 'Organizer')}</div>
        <div style="font-size:0.72rem;color:var(--ac-muted);">${escHtml(e.created_by_email || '')}</div>
      </td>
      <td><div style="font-weight:700;color:var(--ac-blue);">${escHtml(e.title)}</div></td>
      <td>
        <div>${escHtml(e.start_date || 'TBD')} ${e.end_date ? '– ' + escHtml(e.end_date) : ''}</div>
        <div style="font-size:0.72rem;color:var(--ac-muted);">${escHtml(e.venue_name || '')}${e.city ? ', ' + escHtml(e.city) : ''}</div>
      </td>
      <td><span class="pay-chip pay-chip-a">${e.gateway_option === 'OPTION_A_PLATFORM_GATEWAY' ? 'Option A (Platform GW)' : 'Option B (No GW)'}</span></td>
      ${actionCell('ev', e.tournament_id, 'approveEvent', 'rejectEvent', e.title, 'Approve &amp; publish')}
    </tr>`).join('');
}

function checkAdminAuth() {
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (!session || (session.role !== 'super_admin' && session.role !== 'event_manager')) {
    showToast('Admin authorization required to perform verifications.', 'warn');
    return false;
  }
  return true;
}

// ── Approve / reject (one helper for all four queues) ─────────
const QUEUES = {
  swimmer: { table: 'swimmers',    idCol: 'swimmer_id',    prefix: 'sw', entity: 'SWIMMER',    label: 'Swimmer',
             approved: 'APPROVED_ACTIVE', rejected: 'REJECTED',       list: () => PENDING_SWIMMERS,  set: v => { PENDING_SWIMMERS = v; } },
  coach:   { table: 'coaches',     idCol: 'coach_id',      prefix: 'co', entity: 'COACH',      label: 'Coach',
             approved: 'APPROVED_ACTIVE', rejected: 'REJECTED',       list: () => PENDING_COACHES,   set: v => { PENDING_COACHES = v; } },
  academy: { table: 'academies',   idCol: 'academy_id',    prefix: 'ac', entity: 'ACADEMY',    label: 'Academy',
             approved: 'APPROVED_ACTIVE', rejected: 'REJECTED',       list: () => PENDING_ACADEMIES, set: v => { PENDING_ACADEMIES = v; } },
  event:   { table: 'tournaments', idCol: 'tournament_id', prefix: 'ev', entity: 'TOURNAMENT', label: 'Event',
             approved: 'PUBLISHED',       rejected: 'REJECTED_DRAFT', list: () => PENDING_EVENTS,    set: v => { PENDING_EVENTS = v; } },
};

async function decide(kind, approve, id, name) {
  if (!checkAdminAuth()) return;
  const q = QUEUES[kind];
  const { error } = await window.sb.from(q.table)
    .update({ status: approve ? q.approved : q.rejected }).eq(q.idCol, id);
  if (error) {
    showToast(`Failed to ${approve ? 'approve' : 'reject'} ${q.label.toLowerCase()}: ${error.message}`, 'warn');
    return;
  }
  const action = kind === 'event'
    ? (approve ? 'EVENT_APPROVED' : 'EVENT_REJECTED')
    : `${q.entity}_${approve ? 'VERIFIED' : 'REJECTED'}`;
  await writeAudit(action, q.entity, id, `${approve ? 'Approved' : 'Rejected'} ${q.label.toLowerCase()}: ${name}`);
  const cell = $(`${q.prefix}-act-${id}`);
  const doneLabel = approve ? (kind === 'event' ? 'Published' : 'Approved') : 'Rejected';
  if (cell) cell.innerHTML = approve
    ? `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> ${doneLabel}</span>`
    : `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> ${doneLabel}</span>`;
  showToast(`${q.label} "${name}" ${approve ? (kind === 'event' ? 'published!' : 'approved!') : 'rejected.'}`, approve ? 'success' : 'info');
  q.set(q.list().filter(r => String(r[q.idCol]) !== String(id)));
  updateBadgesAndMetrics();
  if (kind === 'event') loadPipeline();
}

window.approveSwimmer = (id, name) => decide('swimmer', true, id, name);
window.rejectSwimmer  = (id, name) => decide('swimmer', false, id, name);
window.approveCoach   = (id, name) => decide('coach', true, id, name);
window.rejectCoach    = (id, name) => decide('coach', false, id, name);
window.approveAcademy = (id, name) => decide('academy', true, id, name);
window.rejectAcademy  = (id, name) => decide('academy', false, id, name);
window.approveEvent   = (id, name) => decide('event', true, id, name);
window.rejectEvent    = (id, name) => decide('event', false, id, name);

// ── Add academy / coach modals ────────────────────────────────
function openModal(id)  { const m = $(id); m.classList.add('active'); m.style.display = 'flex'; }
window.closeModal = function(id) { const m = $(id); m.classList.remove('active'); m.style.display = 'none'; };

window.openAddAcademyModal = () => { setNavOpen(false); openModal('addAcademyModal'); };
window.openAddCoachModal   = () => { setNavOpen(false); loadAcademyOptions(); openModal('addCoachModal'); };

// Populate the "Affiliated Academy" dropdown from the DB
async function loadAcademyOptions() {
  const sel = $('coAcademy');
  if (!sel || !window.sb) return;
  const { data, error } = await window.sb
    .from('academies')
    .select('academy_id, academy_name')
    .order('academy_name', { ascending: true });
  // Keep the first "None / Self" option, drop any previously loaded ones
  sel.querySelectorAll('option[data-db]').forEach(o => o.remove());
  if (error || !data) return;
  data.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.academy_id;
    opt.textContent = a.academy_name;
    opt.setAttribute('data-db', '1');
    sel.appendChild(opt);
  });
}

// Upload a verification document to Supabase Storage; return its public URL
async function uploadVerificationDoc(file, prefix) {
  if (!file || !window.sb) return null;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${prefix}/${Date.now()}_${safe}`;
  const { error } = await window.sb.storage.from('verification-docs').upload(path, file, { upsert: false });
  if (error) { console.error('[SwimFest] doc upload:', error.message); showToast('Document upload failed: ' + error.message, 'warn'); return null; }
  const { data } = window.sb.storage.from('verification-docs').getPublicUrl(path);
  return data ? data.publicUrl : null;
}

window.submitAcademy = async function() {
  const name = $('acName')?.value.trim();
  const city = $('acCity')?.value.trim();
  if (!name || !city) { showToast('Academy name and city are required.', 'warn'); return; }
  if (!window.sb) { showToast('Database not connected.', 'warn'); return; }

  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  const userEmail = session ? session.email : null;

  const file = $('acDoc')?.files?.[0] || null;
  const docUrl = await uploadVerificationDoc(file, 'academies');

  const acRow = {
    academy_name: name,
    city,
    state: $('acState')?.value.trim() || 'Tamil Nadu',
    registration_no: $('acRegNo')?.value.trim() || null,
    contact_person: $('acContact')?.value.trim() || null,
    phone_number: $('acPhone')?.value.trim() || null,
    document_url: docUrl,
    status: 'PENDING_VERIFICATION',
    created_by_email: userEmail,
  };
  let { error } = await window.sb.from('academies').insert(acRow);
  if (error && error.message && error.message.includes('created_by_email')) {
    delete acRow.created_by_email;
    const retry = await window.sb.from('academies').insert(acRow);
    error = retry.error;
  }
  if (error) { console.error('[SwimFest] academy submit:', error.message); showToast('Submit failed: ' + error.message, 'warn'); return; }
  closeModal('addAcademyModal');
  showToast('Academy submitted to Super Admin verification queue.', 'success');
  loadAllQueues();
};

window.submitCoach = async function() {
  const name = $('coName')?.value.trim();
  const license = $('coLicense')?.value.trim();
  if (!name || !license) { showToast('Coach name and license number are required.', 'warn'); return; }
  if (!window.sb) { showToast('Database not connected.', 'warn'); return; }

  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  const userEmail = session ? session.email : null;

  const file = $('coDoc')?.files?.[0] || null;
  const docUrl = await uploadVerificationDoc(file, 'coaches');

  const certBody = $('coCertBody')?.value || '';
  const coRow = {
    full_name: name,
    mobile_number: $('coPhone')?.value.trim() || null,
    certifications: [`${certBody} · ${license}`],
    document_url: docUrl,
    status: 'PENDING_VERIFICATION',
    created_by_email: userEmail,
  };
  let { error } = await window.sb.from('coaches').insert(coRow);
  if (error && error.message && error.message.includes('created_by_email')) {
    delete coRow.created_by_email;
    const retry = await window.sb.from('coaches').insert(coRow);
    error = retry.error;
  }
  if (error) { console.error('[SwimFest] coach submit:', error.message); showToast('Submit failed: ' + error.message, 'warn'); return; }
  closeModal('addCoachModal');
  showToast('Coach submitted to Super Admin verification queue.', 'success');
  loadAllQueues();
};

// ── Sidebar navigation ────────────────────────────────────────
function setNavOpen(open) {
  $('acShell').classList.toggle('nav-open', open);
  $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

function initNav() {
  // In-page links: smooth-scroll and mark the active item
  document.querySelectorAll('.ac-side-link[data-nav]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.getAttribute('data-nav');
      document.querySelectorAll('.ac-side-link[data-nav]').forEach(l => l.classList.toggle('active', l === link));
      if (target === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      else $(target).scrollIntoView({ behavior: 'smooth', block: 'start' });
      setNavOpen(false);
    });
  });

  $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
  $('acScrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setNavOpen(false); });

  // Meet filters
  document.querySelectorAll('#acMeetFilters [data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      MEET_FILTER = btn.getAttribute('data-filter');
      document.querySelectorAll('#acMeetFilters [data-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderPipeline();
    });
  });

  // Close an open "more" menu when clicking elsewhere
  document.addEventListener('click', e => {
    document.querySelectorAll('.ac-more[open]').forEach(d => { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });
}

function renderSidebarUser() {
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (!session) return;
  const name = session.name || (session.role === 'super_admin' ? 'Super Admin' : 'Admin');
  $('acUserName').textContent = name;
  $('acUserInitials').textContent = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD';
}

// ── Toast styles ──────────────────────────────────────────────
(function() {
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast{position:fixed;bottom:28px;right:28px;z-index:99999;
      padding:12px 20px;background:var(--dark);color:var(--white);
      border-radius:var(--radius-sm);font-size:0.85rem;font-weight:500;
      display:flex;align-items:center;gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);
      transform:translateY(20px);opacity:0;transition:all 0.3s ease;
      max-width:420px;font-family:'Inter',sans-serif;}
    .admin-toast.show{transform:translateY(0);opacity:1;}
    .admin-toast i{color:var(--accent);}
    .admin-toast.admin-toast-success i{color:var(--success);}
    .admin-toast.admin-toast-warn i{color:var(--warning);}`;
  document.head.appendChild(s);
})();

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  renderSidebarUser();

  const searchInput = $('adminConsoleSearch');
  const clearBtn    = $('adminConsoleSearchClear');
  const rerender = (val) => { renderSwimmers(val); renderCoaches(val); renderAcademies(val); renderEvents(val); };
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim().toLowerCase();
    clearBtn.style.display = val ? 'block' : 'none';
    rerender(val);
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    rerender('');
  });

  loadPipeline();
  loadAllQueues();
});
