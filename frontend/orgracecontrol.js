/* ============================================================
   SwimFest — Organizer Race Control JS   orgracecontrol.js
   Meet picker, roster and heat downloads, heat lane view,
   and the closure request — all for one selected meet.
   ============================================================ */
'use strict';

const $ = id => document.getElementById(id);

function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function fmtDates(s, e) {
  const f = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
  return s ? `${f(s)}${e ? ' – ' + f(e) : ''}` : '';
}

// 63450 ms → "1:03.45"; 27120 → "27.12"
function fmtTime(ms) {
  if (ms == null) return '';
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
  return min ? `${min}:${sec}` : String(Number(sec).toFixed(2));
}

let MEETS = [];          // this organizer's meets
let MEET = null;         // selected meet
let ENTRIES = [];        // event_entries for the selected meet (with swimmer name/academy)
let HEATS = [];          // [{ key, label, rows: heat_rows sorted by lane }]
let METHOD = 'manual';

const STATUS_PILL = {
  PENDING_APPROVAL:  { cls: 'ac-pill-wait',  label: 'Pending approval' },
  PUBLISHED:         { cls: 'ac-pill-live',  label: 'Published' },
  CLOSED:            { cls: 'ac-pill-wait',  label: 'Registration closed' },
  LOCKED:            { cls: 'ac-pill-live',  label: 'Heats locked' },
  CLOSURE_REQUESTED: { cls: 'ac-pill-wait',  label: 'Closure requested' },
  COMPLETED:         { cls: 'ac-pill-done',  label: 'Completed' },
  REJECTED_DRAFT:    { cls: 'ac-pill-bad',   label: 'Rejected' },
  DRAFT:             { cls: 'ac-pill-draft', label: 'Draft' },
};

// ── Load the organizer's meets into the picker ────────────────
async function loadMeets() {
  const sel = $('rcMeet');
  if (!window.sb) { sel.innerHTML = '<option>Database not connected</option>'; return; }
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (!session || !session.userId) { sel.innerHTML = '<option>Please sign in</option>'; return; }

  // Organizers see only the meets they created; a super admin sees all.
  // Drafts, meets awaiting approval and rejected meets can't be run.
  let query = window.sb.from('tournaments')
    .select('tournament_id, title, start_date, end_date, status, gateway_option, lane_count, venue_name, city')
    .in('status', ['PUBLISHED', 'CLOSED', 'LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'])
    .order('start_date', { ascending: false });
  if (session.role === 'organizer') query = query.eq('created_by', session.userId);
  const { data, error } = await query;
  if (error) { sel.innerHTML = `<option>Could not load meets</option>`; console.error('[SwimFest] race control meets:', error.message); return; }

  MEETS = data || [];
  if (!MEETS.length) {
    sel.innerHTML = '<option>No approved meets yet</option>';
    sel.disabled = true;
    $('rcLaneBody').innerHTML = '<tr><td colspan="7" class="ac-empty-cell">You have no meets yet.</td></tr>';
    return;
  }

  sel.innerHTML = MEETS.map(m => {
    const dates = fmtDates(m.start_date, m.end_date);
    return `<option value="${m.tournament_id}">${escHtml(m.title)}${dates ? ' · ' + dates : ''}</option>`;
  }).join('');

  // ?t=<id> picks a meet; otherwise the first meet that is still running
  const wanted = new URLSearchParams(location.search).get('t');
  const running = MEETS.find(m => ['PUBLISHED', 'CLOSED', 'LOCKED'].includes(m.status));
  const pick = MEETS.find(m => m.tournament_id === wanted) || running || MEETS[0];
  sel.value = pick.tournament_id;
  selectMeet(pick.tournament_id);
}

async function selectMeet(id) {
  MEET = MEETS.find(m => m.tournament_id === id) || null;
  if (!MEET) return;
  history.replaceState(null, '', `${location.pathname}?t=${encodeURIComponent(id)}`);

  const pill = STATUS_PILL[MEET.status] || STATUS_PILL.DRAFT;
  const sp = $('rcStatusPill');
  sp.className = `ac-pill ${pill.cls}`; sp.textContent = pill.label; sp.hidden = false;
  const pp = $('rcPayPill');
  const optionB = MEET.gateway_option !== 'OPTION_A_PLATFORM_GATEWAY';
  pp.className = `ac-pill ${optionB ? 'ac-pill-wait' : 'ac-pill-live'}`;
  pp.textContent = optionB ? 'Option B · offline payments' : 'Option A · online gateway';
  pp.hidden = false;
  updateClosureButton();

  $('rcLaneBody').innerHTML = '<tr><td colspan="7" class="ac-empty-cell">Loading heats…</td></tr>';
  await Promise.all([loadEntries(), loadHeats()]);
  renderMetrics();
  renderHeatPicker();
}

// ── Entries (with swimmer names from the public directory) ────
async function loadEntries() {
  ENTRIES = [];
  const { data, error } = await window.sb.from('event_entries')
    .select('entry_id, swimmer_id, event_name, stroke, distance, category, gender, seed_time_ms, is_relay')
    .eq('tournament_id', MEET.tournament_id);
  if (error) { console.error('[SwimFest] race control entries:', error.message); return; }
  const rows = data || [];

  const ids = [...new Set(rows.map(r => r.swimmer_id).filter(Boolean))];
  const swimmers = {};
  if (ids.length) {
    try {
      const { data: dir } = await window.sb.from('swimmer_directory')
        .select('swimmer_id, full_name, academy_name').in('swimmer_id', ids);
      (dir || []).forEach(s => { swimmers[s.swimmer_id] = s; });
    } catch (_) {}
  }
  ENTRIES = rows.map(r => ({
    ...r,
    swimmer: (swimmers[r.swimmer_id] || {}).full_name || 'Unknown swimmer',
    academy: (swimmers[r.swimmer_id] || {}).academy_name || '',
  }));
}

// ── Heats: heat_rows grouped by event + heat ──────────────────
async function loadHeats() {
  HEATS = [];
  const { data, error } = await window.sb.from('heat_rows')
    .select('heat_row_id, event_entry_id, pool_label, event_no, heat_number, lane_number, finish_time_ms, status, dq_code')
    .eq('tournament_id', MEET.tournament_id)
    .order('event_no', { ascending: true })
    .order('heat_number', { ascending: true })
    .order('lane_number', { ascending: true });
  if (error) { console.error('[SwimFest] race control heats:', error.message); return; }

  const groups = new Map();
  (data || []).forEach(r => {
    const key = `${r.pool_label || ''}|${r.event_no || 0}|${r.heat_number}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  HEATS = [...groups.entries()].map(([key, rows]) => ({ key, rows }));
}

function entryFor(row) { return ENTRIES.find(e => e.entry_id === row.event_entry_id) || null; }

function heatLabel(h) {
  const r = h.rows[0];
  const e = entryFor(r);
  const race = e ? `${e.event_name}${e.category ? ' ' + e.category : ''}${e.gender ? ' ' + e.gender : ''}` : 'Event';
  const sameEvent = HEATS.filter(x => x.rows[0].event_no === r.event_no && (x.rows[0].pool_label || '') === (r.pool_label || '')).length;
  return `${r.event_no ? 'Event ' + r.event_no + ' · ' : ''}${race} · Heat ${r.heat_number} of ${sameEvent}${r.pool_label ? ' · ' + r.pool_label : ''}`;
}

function heatComplete(h) { return h.rows.every(r => r.finish_time_ms != null || (r.status && r.status !== 'OK')); }

function renderMetrics() {
  $('rcAthletes').textContent = new Set(ENTRIES.map(e => e.swimmer_id)).size;
  $('rcEntries').textContent = ENTRIES.length;
  $('rcHeats').textContent = HEATS.length;
  $('rcResults').textContent = `${HEATS.filter(heatComplete).length} / ${HEATS.length}`;
}

function renderHeatPicker() {
  const sel = $('rcHeat');
  if (!HEATS.length) {
    sel.innerHTML = '<option>No heats yet</option>';
    sel.disabled = true;
    $('rcLaneBody').innerHTML = `<tr><td colspan="7" class="ac-empty-cell">No heats have been generated for this meet yet.${ENTRIES.length ? ` It has ${ENTRIES.length} race ${ENTRIES.length === 1 ? 'entry' : 'entries'} waiting.` : ''}</td></tr>`;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = HEATS.map((h, i) => `<option value="${i}">${escHtml(heatLabel(h))}</option>`).join('');
  sel.value = '0';
  renderLanes(0);
}

function renderLanes(index) {
  const h = HEATS[index];
  if (!h) return;
  const laneCount = Math.max(MEET.lane_count || 8, ...h.rows.map(r => r.lane_number));
  const byLane = {};
  h.rows.forEach(r => { byLane[r.lane_number] = r; });
  const rows = [];
  for (let lane = 1; lane <= laneCount; lane++) {
    const r = byLane[lane];
    if (!r) {
      rows.push(`<tr class="rc-empty-lane"><td><span class="rc-lane">${lane}</span></td><td colspan="6">Empty lane</td></tr>`);
      continue;
    }
    const e = entryFor(r);
    const status = r.status || 'OK';
    const statusCls = status === 'OK' ? (r.finish_time_ms != null ? 'ac-pill-live' : 'ac-pill-draft') : 'ac-pill-bad';
    rows.push(`<tr>
      <td><span class="rc-lane">${lane}</span></td>
      <td style="font-weight:600;">${escHtml(e ? e.swimmer : 'Unknown swimmer')}</td>
      <td style="color:var(--ac-muted);">${escHtml(e ? e.academy : '')}</td>
      <td class="rc-mono" style="color:var(--ac-muted);">${e && e.seed_time_ms != null ? fmtTime(e.seed_time_ms) : 'NT'}</td>
      <td class="rc-mono" style="font-weight:600;">${r.finish_time_ms != null ? fmtTime(r.finish_time_ms) : '<span style="color:#94a3b8;font-weight:500;">Not entered</span>'}</td>
      <td><span class="ac-pill ${statusCls}">${status === 'OK' && r.finish_time_ms == null ? 'Waiting' : escHtml(status)}</span></td>
      <td style="color:var(--ac-muted);">${escHtml(r.dq_code || '')}</td>
    </tr>`);
  }
  $('rcLaneBody').innerHTML = rows.join('');
}

// ── Downloads (CSV opens in Excel) ────────────────────────────
function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });   // BOM so Excel reads ₹ and names correctly
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function safeName(s) { return String(s || 'meet').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 60); }

window.downloadEntries = function() {
  if (!MEET) return;
  if (!ENTRIES.length) { showToast('This meet has no race entries yet.', 'info'); return; }
  const rows = [...ENTRIES]
    .sort((a, b) => (a.event_name || '').localeCompare(b.event_name || '') || a.swimmer.localeCompare(b.swimmer))
    .map(e => [e.swimmer, e.academy, e.gender, e.category, e.event_name, e.stroke, e.distance, e.seed_time_ms != null ? fmtTime(e.seed_time_ms) : 'NT', e.is_relay ? 'Yes' : 'No']);
  downloadCsv(`${safeName(MEET.title)}_entries.csv`,
    ['Swimmer', 'Academy', 'Gender', 'Category', 'Event', 'Stroke', 'Distance (m)', 'Seed time', 'Relay'], rows);
  showToast(`Downloaded ${ENTRIES.length} entries.`, 'success');
};

// Touch-pad: lane assignments for the timing system. Manual: the same
// sheet with blank Finish time / Status / DQ columns to fill in by hand.
window.downloadHeatSheet = function() {
  if (!MEET) return;
  if (!HEATS.length) { showToast('No heats have been generated for this meet yet.', 'warn'); return; }
  const rows = [];
  HEATS.forEach(h => h.rows.forEach(r => {
    const e = entryFor(r);
    const base = [r.pool_label || '', r.event_no || '', e ? e.event_name : '', e ? e.category : '', e ? e.gender : '',
      r.heat_number, r.lane_number, e ? e.swimmer : '', e ? e.academy : '', e && e.seed_time_ms != null ? fmtTime(e.seed_time_ms) : 'NT'];
    rows.push(METHOD === 'manual' ? [...base, r.finish_time_ms != null ? fmtTime(r.finish_time_ms) : '', r.status || 'OK', r.dq_code || ''] : base);
  }));
  const header = ['Pool', 'Event no', 'Event', 'Category', 'Gender', 'Heat', 'Lane', 'Swimmer', 'Academy', 'Seed time'];
  if (METHOD === 'manual') header.push('Finish time (MM:SS.ss)', 'Status (OK/DNS/DNF/DQ)', 'DQ code');
  downloadCsv(`${safeName(MEET.title)}_${METHOD === 'manual' ? 'result_sheet' : 'heat_sheet'}.csv`, header, rows);
  showToast(`Downloaded ${HEATS.length} heats.`, 'success');
};

const METHODS = {
  touchpad: {
    help: 'Electronic timing: export the lane assignments for your timing system, then import the result file it gives back.',
    download: 'Export heat sheet for timing system',
    upload: 'Import touch-pad result file',
  },
  manual: {
    help: 'Stopwatch timing: download a sheet with every heat and lane filled in, write the times on it, then import it.',
    download: 'Download result sheet',
    upload: 'Import filled result sheet',
  },
};

function setMethod(m) {
  METHOD = m;
  document.querySelectorAll('#rcMethod [data-method]').forEach(b => b.classList.toggle('active', b.getAttribute('data-method') === m));
  $('rcMethodHelp').textContent = METHODS[m].help;
  $('rcMethodDownload').textContent = METHODS[m].download;
  $('rcMethodUpload').textContent = METHODS[m].upload;
}

// ── Request closure → status CLOSURE_REQUESTED for super admin sign-off
function updateClosureButton() {
  const btn = $('rcClosureBtn');
  const label = $('rcClosureLabel');
  const canRequest = ['PUBLISHED', 'CLOSED', 'LOCKED'].includes(MEET.status);
  btn.disabled = !canRequest;
  label.textContent = MEET.status === 'CLOSURE_REQUESTED' ? 'Closure requested'
    : MEET.status === 'COMPLETED' ? 'Meet completed' : 'Request closure';
  btn.title = canRequest ? '' : 'Only a published or running meet can be closed';
}

window.openClosureModal = function() {
  if (!MEET) return;
  $('closureMeetName').textContent = MEET.title;
  $('closureAthletes').textContent = $('rcAthletes').textContent;
  $('closureEntries').textContent = $('rcEntries').textContent;
  $('closureResults').textContent = $('rcResults').textContent;
  const m = $('closureModal'); m.classList.add('active'); m.style.display = 'flex';
};

window.closeClosureModal = function() {
  const m = $('closureModal'); m.classList.remove('active'); m.style.display = 'none';
};

window.confirmClosure = async function() {
  if (!MEET || !window.sb) return;
  const { error } = await window.sb.from('tournaments')
    .update({ status: 'CLOSURE_REQUESTED' }).eq('tournament_id', MEET.tournament_id);
  if (error) { showToast('Could not send the request: ' + error.message, 'warn'); return; }
  closeClosureModal();
  MEET.status = 'CLOSURE_REQUESTED';
  const pill = STATUS_PILL.CLOSURE_REQUESTED;
  $('rcStatusPill').className = `ac-pill ${pill.cls}`;
  $('rcStatusPill').textContent = pill.label;
  updateClosureButton();
  showToast('Closure request sent to the super admin for sign-off.', 'success');
};

// ── Sidebar + organizer identity ──────────────────────────────
function setNavOpen(open) {
  $('acShell').classList.toggle('nav-open', open);
  $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Admins and super admins run every meet from here, with the
// Admin console links instead of the organizer's.
function renderStaffNav(session) {
  const link = (href, icon, label, active) =>
    `<a href="${href}" class="ac-side-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}><i class="fas fa-${icon}"></i> ${label}</a>`;
  $('rcNav').innerHTML = `
    <nav class="ac-side-group">${link('admin.html', 'table-columns', 'Overview')}${link('admin.html#verificationQueues', 'clipboard-check', 'Approvals')}</nav>
    <nav class="ac-side-group" aria-label="Meets"><div class="ac-side-label">Meets</div>
      ${link('admin.html#myMeets', 'trophy', 'My meets')}${link('playerlist.html', 'list-check', 'Master player list')}
      ${link('heatgen.html', 'bolt', 'Heat generation')}${link('results.html', 'broadcast-tower', 'Live results')}
      ${link('orgracecontrol.html', 'flag-checkered', 'Race control', true)}</nav>
    <nav class="ac-side-group" aria-label="Create"><div class="ac-side-label">Create</div>${link('orgcreate.html', 'plus', 'Add meet')}</nav>`;
  $('rcBrand').setAttribute('href', 'admin.html');
  $('rcBrandSub').textContent = 'Admin Console';
  const name = session.name || session.email || 'Signed in';
  $('orgName').textContent = name;
  $('orgInitials').textContent = String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD';
  $('orgIdBadge').textContent = session.role === 'super_admin' ? 'Super Admin' : 'Admin';
  if (session.role === 'super_admin') { $('rcUserLink').setAttribute('href', 'saprofile.html'); $('rcUserLink').title = 'Your profile'; }
  else { $('rcUserLink').removeAttribute('href'); $('rcUserLink').removeAttribute('title'); }
}

async function renderOrgIdentity() {
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (!session) return;
  if (session.role !== 'organizer') { renderStaffNav(session); return; }
  if (session.userId) $('orgIdBadge').textContent = 'Organizer · ID ' + String(session.userId).slice(0, 8).toUpperCase();
  let name = session.name || 'My Organization';
  try {
    const { data } = await window.sb.from('organizers').select('org_name').eq('owner_id', session.userId).maybeSingle();
    if (data && data.org_name) name = data.org_name;
  } catch (_) {}
  $('orgName').textContent = name;
  $('orgInitials').textContent = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'OR';
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const e = document.querySelector('.admin-toast'); if (e) e.remove();
  const t = document.createElement('div');
  t.className = `admin-toast admin-toast-${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'warn' ? 'exclamation-triangle' : 'info-circle';
  t.innerHTML = `<i class="fas fa-${icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
}
window.showToast = showToast;

(function() {
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast{position:fixed;bottom:28px;right:28px;z-index:99999;padding:12px 20px;background:var(--dark);color:var(--white);border-radius:var(--radius-sm);font-size:0.85rem;font-weight:500;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);transform:translateY(20px);opacity:0;transition:all 0.3s ease;max-width:420px;font-family:'Inter',sans-serif;}
    .admin-toast.show{transform:translateY(0);opacity:1;}
    .admin-toast i{color:var(--accent);}
    .admin-toast.admin-toast-success i{color:var(--success);}
    .admin-toast.admin-toast-warn i{color:var(--warning);}`;
  document.head.appendChild(s);
})();

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setMethod('manual');
  document.querySelectorAll('#rcMethod [data-method]').forEach(b => b.addEventListener('click', () => setMethod(b.getAttribute('data-method'))));
  $('rcMeet').addEventListener('change', e => selectMeet(e.target.value));
  $('rcHeat').addEventListener('change', e => renderLanes(Number(e.target.value)));

  $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
  $('acScrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { setNavOpen(false); closeClosureModal(); } });

  renderOrgIdentity();
  if (window.SwimNav) window.SwimNav.applySuperAdmin({ nav: 'rcNav', brand: 'rcBrand', brandSub: 'rcBrandSub', userLink: 'rcUserLink', name: 'orgName', initials: 'orgInitials', role: 'orgIdBadge' }, 'orgracecontrol.html');
  loadMeets();
});
