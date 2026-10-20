/* ============================================================
   SwimFest — Master Player List  (Chapter 7)
   admin.js — loaded by playerlist.html
   One row per swimmer × event (Rule 7.1). Edits, removals and
   walk-in swimmers are saved to Supabase straight away.
   ============================================================ */

'use strict';

// ─── Constants ────────────────────────────────────────────────
const CATEGORIES = [
  { label:'U-10', minAge:8,  maxAge:9  },
  { label:'U-12', minAge:10, maxAge:11 },
  { label:'U-14', minAge:12, maxAge:13 },
  { label:'U-16', minAge:14, maxAge:15 },
];
const MAX_INDIVIDUAL_EVENTS = 3;
// Meets in these states can no longer be changed here
const READ_ONLY_STATUSES = ['LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'];

let ROSTER = [];
let MEETS = [];
let MEET = null;
let pendingDeleteId = null;
let SESSION = null;

// ─── Utilities ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function msToSeed(ms) {
  if (!ms || ms <= 0) return 'NT';
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
  return `${String(min).padStart(2,'0')}:${sec}`;
}

// "00:39.20" → 39200; "NT" → null; invalid → undefined
function seedToMs(text) {
  const t = String(text || '').trim().toUpperCase();
  if (!t || t === 'NT') return null;
  const m = /^(\d{1,2}):(\d{2})\.(\d{1,2})$/.exec(t);
  if (!m) return undefined;
  const frac = m[3].length === 1 ? Number(m[3]) * 100 : Number(m[3]) * 10;
  return Number(m[1]) * 60000 + Number(m[2]) * 1000 + frac;
}

function meetYear() {
  return MEET && MEET.start_date ? new Date(MEET.start_date).getFullYear() : new Date().getFullYear();
}

function deriveCategoryFromDob(dob) {
  if (!dob) return null;
  const age = meetYear() - new Date(dob).getFullYear();
  return CATEGORIES.find(c => age >= c.minAge && age <= c.maxAge) || null;
}

function formatDate(dob) {
  if (!dob) return '—';
  const [y, m, d] = dob.split('-');
  return `${d}/${m}/${y}`;
}

function openModal(id)  { const m=$(id); m.classList.add('active'); m.style.display='flex'; }
function closeModal(id) { const m=$(id); m.classList.remove('active'); m.style.display='none'; }

function isReadOnly() { return !MEET || READ_ONLY_STATUSES.includes(MEET.status); }

// ─── Sidebar: links depend on the signed-in role ──────────────
function sideLink(href, icon, label, active) {
  return `<a href="${href}" class="ac-side-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}><i class="fas fa-${icon}"></i> ${label}</a>`;
}
function sideGroup(label, links) {
  return `<nav class="ac-side-group" aria-label="${label || 'Main'}">${label ? `<div class="ac-side-label">${label}</div>` : ''}${links.join('')}</nav>`;
}

function renderSidebar() {
  const role = SESSION ? SESSION.role : 'event_manager';
  let html;
  if (role === 'organizer') {
    $('plBrand').setAttribute('href', 'orgdashboard.html');
    $('plBrandSub').textContent = 'Organizer Dashboard';
    html = sideGroup('', [
        sideLink('orgdashboard.html', 'table-columns', 'Overview'),
        sideLink('orgdashboard.html#myMeets', 'trophy', 'My meets'),
      ])
      + sideGroup('Run a meet', [
        sideLink('orgracecontrol.html', 'flag-checkered', 'Race control'),
        sideLink('playerlist.html', 'list-check', 'Player list', true),
        sideLink('results.html', 'broadcast-tower', 'Live results'),
      ])
      + sideGroup('Create', [sideLink('orgcreate.html', 'plus', 'Create event')]);
    // The name at the bottom opens the organization profile
    $('plUserLink').setAttribute('href', 'orgprofile.html');
    $('plUserLink').title = 'Organization profile';
  } else {
    html = sideGroup('', [
        sideLink('admin.html', 'table-columns', 'Overview'),
        sideLink('admin.html#verificationQueues', 'clipboard-check', 'Approvals'),
      ])
      + sideGroup('Meets', [
        sideLink('admin.html#myMeets', 'trophy', 'My meets'),
        sideLink('playerlist.html', 'list-check', 'Master player list', true),
        sideLink('heatgen.html', 'bolt', 'Heat generation'),
        sideLink('results.html', 'broadcast-tower', 'Live results'),
        sideLink('orgracecontrol.html', 'flag-checkered', 'Race control'),
      ])
      + sideGroup('Create', [sideLink('orgcreate.html', 'plus', 'Add meet')]);
  }
  $('plNav').innerHTML = html;

  if (SESSION) {
    const name = SESSION.name || SESSION.email || 'Signed in';
    $('plUserName').textContent = name;
    $('plUserRole').textContent = { organizer: 'Organizer', event_manager: 'Admin', super_admin: 'Super Admin' }[role] || '';
    $('plInitials').textContent = String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SF';
  }
}

function setNavOpen(open) {
  $('acShell').classList.toggle('nav-open', open);
  $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ── Supabase: meets for the picker ────────────────────────────
// Organizers see only meets they created; staff see every meet.
// Only approved meets: drafts, meets awaiting approval and rejected meets are left out.
async function loadAdminTournaments() {
  const sel = $('adminTournamentSelect');
  if (!window.sb) { sel.innerHTML = '<option value="">Database not connected</option>'; return; }
  let query = window.sb.from('tournaments')
    .select('tournament_id, title, status, start_date, end_date')
    .in('status', ['PUBLISHED', 'CLOSED', 'LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'])
    .order('start_date', { ascending: false });
  if (SESSION && SESSION.role === 'organizer') query = query.eq('created_by', SESSION.userId);
  const { data, error } = await query;
  if (error || !data || !data.length) {
    sel.innerHTML = '<option value="">No approved meets yet</option>';
    sel.disabled = true;
    MEET = null; ROSTER = []; renderStatus(); renderGrid();
    return;
  }
  MEETS = data;
  const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
  sel.innerHTML = data.map(t => `<option value="${t.tournament_id}">${escHtml(t.title)}${t.start_date ? ' · ' + fmt(t.start_date) : ''}</option>`).join('');

  // Honor ?t=<tournament_id> deep links from the dashboards
  const wanted = new URLSearchParams(location.search).get('t');
  if (wanted && data.some(t => t.tournament_id === wanted)) sel.value = wanted;
  await loadRoster(sel.value);
}

// ── Supabase: event_entries + swimmer details for a meet ──────
async function loadRoster(tournamentId, silent = false) {
  MEET = MEETS.find(m => m.tournament_id === tournamentId) || null;
  if (!silent && MEET) history.replaceState(null, '', `${location.pathname}?t=${encodeURIComponent(tournamentId)}`);
  renderStatus();
  if (!window.sb || !MEET) { ROSTER = []; renderGrid(); return; }

  const { data, error } = await window.sb
    .from('event_entries')
    .select('entry_id, event_name, category, gender, seed_time_ms, swimmer_id, is_relay')
    .eq('tournament_id', tournamentId);
  if (error) { console.error('[SwimFest] roster load:', error.message); ROSTER = []; renderGrid(); return; }

  const entries = data || [];
  const swimmerIds = [...new Set(entries.map(e => e.swimmer_id).filter(Boolean))];
  const swimmers = {};
  if (swimmerIds.length) {
    const { data: sw } = await window.sb.from('swimmers')
      .select('swimmer_id, full_name, gender, date_of_birth, status, academy_id, sfi_serial_no')
      .in('swimmer_id', swimmerIds);
    (sw || []).forEach(s => { swimmers[s.swimmer_id] = s; });
    // Academy names (and a fallback name source if swimmers is restricted)
    const { data: dir } = await window.sb.from('swimmer_directory')
      .select('swimmer_id, full_name, academy_name').in('swimmer_id', swimmerIds);
    (dir || []).forEach(d => {
      swimmers[d.swimmer_id] = { ...(swimmers[d.swimmer_id] || {}), academy_name: d.academy_name,
        full_name: (swimmers[d.swimmer_id] || {}).full_name || d.full_name };
    });
  }

  ROSTER = entries.map(e => {
    const s = swimmers[e.swimmer_id] || {};
    const dob = s.date_of_birth || '';
    return {
      id: e.entry_id,
      swimmerId: e.swimmer_id,
      swimId: s.sfi_serial_no || (e.swimmer_id ? String(e.swimmer_id).slice(0, 8).toUpperCase() : '—'),
      name: s.full_name || 'Unknown swimmer',
      swimmerGender: s.gender || '',
      gender: e.gender,
      dob,
      age: dob ? meetYear() - new Date(dob).getFullYear() : '',
      category: e.category,
      academy: s.academy_name || 'Unattached',
      event: e.event_name,
      isRelay: !!e.is_relay,
      seedMs: e.seed_time_ms,
      seedTime: msToSeed(e.seed_time_ms),
      status: s.status || '',
      flags: [],
    };
  });
  computeFlags();
  populateAcademyFilter();
  renderGrid();
  if (!silent && !ROSTER.length) showToast('This meet has no entries yet.', 'info');
}

// Things worth a second look before locking
function computeFlags() {
  const individualCount = {};
  ROSTER.forEach(r => { if (!r.isRelay) individualCount[r.swimmerId] = (individualCount[r.swimmerId] || 0) + 1; });
  ROSTER.forEach(r => {
    r.flags = [];
    const cat = deriveCategoryFromDob(r.dob);
    if (r.dob && (!cat || cat.label !== r.category)) {
      r.flags.push({ type: 'dob_conflict', msg: cat ? `Age says ${cat.label}, entered in ${r.category}` : `Age ${r.age} is outside U-10 to U-16` });
    }
    if (r.swimmerGender && r.swimmerGender !== r.gender) r.flags.push({ type: 'gender', msg: `${r.swimmerGender} entered in a ${r.gender === 'Girl' ? 'girls' : 'boys'} event` });
    if ((individualCount[r.swimmerId] || 0) > MAX_INDIVIDUAL_EVENTS) r.flags.push({ type: 'cap', msg: `In ${individualCount[r.swimmerId]} individual events (max ${MAX_INDIVIDUAL_EVENTS})` });
    if (r.status === 'PENDING_VERIFICATION') r.flags.push({ type: 'pending', msg: 'Swimmer profile not verified yet' });
    if (r.status === 'REJECTED') r.flags.push({ type: 'rejected', msg: 'Swimmer profile was rejected' });
  });
}

// ─── Status pill + lock card ──────────────────────────────────
const STATUS_PILL = {
  PENDING_APPROVAL:  { cls: 'ac-pill-wait',  label: 'Pending approval' },
  PUBLISHED:         { cls: 'ac-pill-live',  label: 'Registration open' },
  CLOSED:            { cls: 'ac-pill-wait',  label: 'Registration closed' },
  LOCKED:            { cls: 'ac-pill-done',  label: 'Player list locked' },
  CLOSURE_REQUESTED: { cls: 'ac-pill-wait',  label: 'Closure requested' },
  COMPLETED:         { cls: 'ac-pill-done',  label: 'Completed' },
  REJECTED_DRAFT:    { cls: 'ac-pill-bad',   label: 'Rejected' },
  DRAFT:             { cls: 'ac-pill-draft', label: 'Draft' },
};

function renderStatus() {
  const chip = $('regStatusChip');
  if (!MEET) { chip.className = 'ac-pill ac-pill-draft'; chip.textContent = '—'; }
  else {
    const p = STATUS_PILL[MEET.status] || STATUS_PILL.DRAFT;
    chip.className = `ac-pill ${p.cls}`;
    chip.textContent = p.label;
  }
  const ro = isReadOnly();
  $('addManualBtn').disabled = ro;
  $('addManualBtn').title = ro ? 'This meet is locked' : '';

  const locked = MEET && READ_ONLY_STATUSES.includes(MEET.status);
  $('lockIcon').className = `pl-lock-icon${locked ? ' done' : ''}`;
  $('lockIcon').innerHTML = `<i class="fas fa-${locked ? 'check' : 'lock'}"></i>`;
  $('lockTitle').textContent = locked ? 'Player list is locked' : 'Lock the player list';
  $('lockText').textContent = locked
    ? 'Entries are read-only. The meet has moved on to heat generation and racing.'
    : 'When every entry is right, lock the list. Entries become read-only and the meet moves on to heat generation. This can\'t be undone.';
  $('lockActions').style.display = locked || !MEET ? 'none' : '';
  if (locked) $('auditResults').style.display = 'none';
}

// ─── Stats ────────────────────────────────────────────────────
function updateBanner() {
  const uniqueSwimmers = new Set(ROSTER.map(r => r.swimmerId)).size;
  const flaggedCount   = ROSTER.filter(r => r.flags.length > 0).length;
  $('totalEntries').textContent   = uniqueSwimmers;
  $('totalEventRows').textContent = ROSTER.length;
  $('statFlagged').textContent    = flaggedCount;
  $('statClean').textContent      = ROSTER.length - flaggedCount;
}

// ─── Academy filter ───────────────────────────────────────────
function populateAcademyFilter() {
  const sel = $('filterAcademy');
  const current = sel.value;
  const academies = [...new Set(ROSTER.map(r => r.academy).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All academies</option>' +
    academies.map(a => `<option value="${escHtml(a)}">${escHtml(a)}</option>`).join('');
  if (academies.includes(current)) sel.value = current;
}

// ─── Filter logic ─────────────────────────────────────────────
function getFilteredRoster() {
  const q       = $('rosterSearch').value.trim().toLowerCase();
  const cat     = $('filterCategory').value;
  const gender  = $('filterGender').value;
  const academy = $('filterAcademy').value;
  const flag    = $('filterFlag').value;

  $('rosterSearchClear').style.display = q ? '' : 'none';

  return ROSTER.filter(row => {
    const matchQ = !q
      || row.name.toLowerCase().includes(q)
      || row.swimId.toLowerCase().includes(q)
      || row.academy.toLowerCase().includes(q)
      || String(row.event || '').toLowerCase().includes(q);
    const matchCat    = !cat     || row.category === cat;
    const matchGender = !gender  || row.gender === gender;
    const matchAcad   = !academy || row.academy === academy;
    const matchFlag   = !flag
      || (flag === 'flagged' && row.flags.length > 0)
      || (flag === 'clean'   && row.flags.length === 0);
    return matchQ && matchCat && matchGender && matchAcad && matchFlag;
  });
}

// ─── Render grid ──────────────────────────────────────────────
function renderGrid() {
  const rows  = getFilteredRoster();
  const tbody = $('adminGridBody');
  const empty = $('adminEmpty');
  tbody.innerHTML = '';
  updateBanner();

  if (rows.length === 0) {
    empty.textContent = !MEET ? 'Pick a meet to see its entries.'
      : ROSTER.length ? 'No entries match your filters.' : 'This meet has no entries yet.';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  const ro = isReadOnly();

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.rowId = row.id;
    if (row.flags.length > 0) tr.classList.add('pl-flagged');

    const statusTag = row.status === 'PENDING_VERIFICATION'
      ? '<span class="pl-tag pl-tag-wait"><i class="fas fa-clock"></i> Pending</span>'
      : row.status === 'REJECTED' ? '<span class="pl-tag pl-tag-bad"><i class="fas fa-times-circle"></i> Rejected</span>' : '';
    const flagsHtml = row.flags.map(f => `<div class="pl-flag"><i class="fas fa-triangle-exclamation"></i> ${escHtml(f.msg)}</div>`).join('');
    const isNT = row.seedTime === 'NT';

    tr.innerHTML = `
      <td style="color:var(--ac-muted);font-variant-numeric:tabular-nums;">${idx + 1}</td>
      <td>
        <div class="pl-name">${escHtml(row.name)} ${statusTag}</div>
        <div class="pl-sub">${escHtml(row.swimId)}</div>
        ${flagsHtml}
      </td>
      <td>
        <div>${escHtml(row.gender)} · ${formatDate(row.dob)}</div>
        <div class="pl-sub">${row.age !== '' ? 'Age ' + row.age : 'DOB not available'}</div>
      </td>
      <td><span class="pl-cat ${row.gender === 'Girl' ? 'girls' : 'boys'}">${row.gender === 'Girl' ? 'Girls' : 'Boys'} ${escHtml(row.category)}</span></td>
      <td>${escHtml(row.academy)}</td>
      <td>${escHtml(row.event)}${row.isRelay ? ' <span class="pl-tag pl-tag-walk">Relay</span>' : ''}</td>
      <td><span class="pl-seed${isNT ? ' nt' : ''}">${escHtml(row.seedTime)}</span></td>
      <td>${ro
        ? '<span class="pl-sub" style="font-style:italic;">Locked</span>'
        : `<div class="pl-actions">
             <button type="button" class="pl-icon-btn btn-edit"><i class="fas fa-pen"></i> Edit</button>
             <button type="button" class="pl-icon-btn danger btn-del" aria-label="Remove entry"><i class="fas fa-trash"></i></button>
           </div>`}
      </td>`;

    tr.querySelector('.btn-edit')?.addEventListener('click', () => startEdit(row.id, tr));
    tr.querySelector('.btn-del')?.addEventListener('click',  () => triggerDelete(row.id, row.name, row.event));
    tbody.appendChild(tr);
  });
}

// ─── Inline edit: seed time + category (Rule 7.2) ─────────────
function startEdit(rowId, tr) {
  const row = ROSTER.find(r => r.id === rowId);
  if (!row) return;
  tr.classList.add('row-editing');

  tr.cells[6].innerHTML = `<input type="text" class="pl-edit-input" id="editSeed_${rowId}" value="${escHtml(row.seedTime)}" placeholder="MM:SS.ss or NT" maxlength="10" aria-label="Seed time">`;
  tr.cells[3].innerHTML = `<select class="pl-edit-select" id="editCat_${rowId}" aria-label="Category">
      ${CATEGORIES.map(c => `<option value="${c.label}" ${row.category === c.label ? 'selected' : ''}>${row.gender === 'Girl' ? 'Girls' : 'Boys'} ${c.label}</option>`).join('')}
    </select>`;
  tr.cells[7].innerHTML = `<div class="pl-actions">
      <button type="button" class="pl-icon-btn primary btn-save"><i class="fas fa-check"></i> Save</button>
      <button type="button" class="pl-icon-btn btn-cancel" aria-label="Cancel"><i class="fas fa-times"></i></button>
    </div>`;
  tr.cells[7].querySelector('.btn-save').addEventListener('click', () => saveEdit(rowId));
  tr.cells[7].querySelector('.btn-cancel').addEventListener('click', () => renderGrid());
  $(`editSeed_${rowId}`).focus();
}

async function saveEdit(rowId) {
  const row = ROSTER.find(r => r.id === rowId);
  if (!row) return;
  const seedText = $(`editSeed_${rowId}`)?.value.trim() || 'NT';
  const newCat   = $(`editCat_${rowId}`)?.value || row.category;
  const ms = seedToMs(seedText);
  if (ms === undefined) { showToast('Seed time must look like 00:39.20, or NT for no time.', 'warn'); return; }

  // .select() returns the changed rows, so a blocked update shows up as 0 rows
  const { data, error } = await window.sb.from('event_entries')
    .update({ seed_time_ms: ms, category: newCat }).eq('entry_id', rowId).select('entry_id');
  if (error || !data || !data.length) {
    showToast(error ? `Could not save: ${error.message}` : 'Your account is not allowed to change entries.', 'warn');
    return;
  }
  row.seedMs = ms;
  row.seedTime = msToSeed(ms);
  row.category = newCat;
  computeFlags();
  showToast(`Saved: ${row.name} — ${row.event}`, 'success');
  renderGrid();
}

// ─── Remove an entry (Rule 7.2) ───────────────────────────────
function triggerDelete(rowId, name, event) {
  pendingDeleteId = rowId;
  $('deleteModalMsg').innerHTML =
    `Remove <strong>${escHtml(name)}</strong> from <em>${escHtml(event)}</em>?<br>
     <span style="font-size:0.8rem;color:var(--ac-muted);">The swimmer's other races are not affected.</span>`;
  openModal('deleteModal');
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  const { data, error } = await window.sb.from('event_entries').delete().eq('entry_id', id).select('entry_id');
  if (error || !data || !data.length) {
    showToast(error ? `Could not remove: ${error.message}` : 'Your account is not allowed to remove entries.', 'warn');
    return;
  }
  pendingDeleteId = null;
  closeModal('deleteModal');
  ROSTER = ROSTER.filter(r => r.id !== id);
  computeFlags();
  populateAcademyFilter();
  showToast('Entry removed.', 'success');
  renderGrid();
}

// ─── Walk-in swimmer (Rule 7.2) ───────────────────────────────
async function openManualModal() {
  if (isReadOnly()) return;
  ['mFullName','mDob','mSeedTime','mContact'].forEach(id => { $(id).value = ''; });
  $('mGender').value = 'Boy';
  $('mEvent').innerHTML = '<option value="">Pick gender and date of birth first</option>';
  $('mDerivedRow').style.display = 'none';
  $('mError').textContent = '';

  const sel = $('mAcademy');
  sel.innerHTML = '<option value="">None / unattached</option>';
  try {
    const { data } = await window.sb.from('academies').select('academy_id, academy_name, city, status').order('academy_name');
    (data || []).filter(a => !a.status || a.status === 'APPROVED_ACTIVE').forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.academy_id;
      opt.textContent = a.city ? `${a.academy_name} (${a.city})` : a.academy_name;
      sel.appendChild(opt);
    });
  } catch (_) {}
  openModal('manualEntryModal');
}

function updateManualDerived() {
  const dob = $('mDob').value;
  const cat = deriveCategoryFromDob(dob);
  if (!dob || !cat) {
    $('mDerivedRow').style.display = 'none';
    $('mEvent').innerHTML = `<option value="">${dob ? 'Age is outside U-10 to U-16' : 'Pick gender and date of birth first'}</option>`;
    return;
  }
  const gender = $('mGender').value;
  const yob = new Date(dob).getFullYear();
  $('mYob').textContent = yob;
  $('mAge').textContent = meetYear() - yob;
  $('mCategory').textContent = `${gender === 'Girl' ? 'GIRLS' : 'BOYS'} ${cat.label}`;
  $('mDerivedRow').style.display = '';

  const EVENT_MASTER = window.SWIMFEST_EVENT_MASTER || getEventMasterLocal();
  const events = EVENT_MASTER.filter(e => e.gender === gender && e.category === cat.label);
  $('mEvent').innerHTML = '<option value="">Select event</option>' +
    events.map(e => `<option value="${escHtml(e.name)}">${escHtml(e.name)}</option>`).join('');
}

function getEventMasterLocal() {
  // Fallback list used when register.js isn't loaded
  return [
    {gender:'Boy',  category:'U-10', name:'25m Freestyle'},
    {gender:'Boy',  category:'U-10', name:'25m Backstroke'},
    {gender:'Boy',  category:'U-12', name:'50m Freestyle'},
    {gender:'Boy',  category:'U-12', name:'100m Freestyle'},
    {gender:'Boy',  category:'U-12', name:'50m Backstroke'},
    {gender:'Boy',  category:'U-12', name:'50m Breaststroke'},
    {gender:'Boy',  category:'U-12', name:'50m Butterfly'},
    {gender:'Boy',  category:'U-14', name:'50m Freestyle'},
    {gender:'Boy',  category:'U-14', name:'100m Freestyle'},
    {gender:'Boy',  category:'U-14', name:'200m Freestyle'},
    {gender:'Boy',  category:'U-14', name:'50m Backstroke'},
    {gender:'Boy',  category:'U-14', name:'50m Breaststroke'},
    {gender:'Boy',  category:'U-14', name:'50m Butterfly'},
    {gender:'Boy',  category:'U-16', name:'50m Freestyle'},
    {gender:'Boy',  category:'U-16', name:'100m Freestyle'},
    {gender:'Boy',  category:'U-16', name:'50m Butterfly'},
    {gender:'Girl', category:'U-10', name:'25m Freestyle'},
    {gender:'Girl', category:'U-12', name:'50m Freestyle'},
    {gender:'Girl', category:'U-12', name:'100m Freestyle'},
    {gender:'Girl', category:'U-12', name:'50m Backstroke'},
    {gender:'Girl', category:'U-12', name:'50m Breaststroke'},
    {gender:'Girl', category:'U-14', name:'50m Freestyle'},
    {gender:'Girl', category:'U-14', name:'100m Freestyle'},
    {gender:'Girl', category:'U-14', name:'200m Freestyle'},
    {gender:'Girl', category:'U-16', name:'100m Freestyle'},
    {gender:'Girl', category:'U-16', name:'200m Freestyle'},
    {gender:'Girl', category:'U-16', name:'50m Butterfly'},
  ];
}

async function saveManualEntry() {
  const err = msg => { $('mError').textContent = msg; };
  const name     = $('mFullName').value.trim();
  const gender   = $('mGender').value;
  const dob      = $('mDob').value;
  const academy  = $('mAcademy').value;
  const event    = $('mEvent').value;
  const seedText = $('mSeedTime').value.trim() || 'NT';
  const phone    = $('mContact').value.trim();

  if (!name)  return err('Enter the swimmer\'s full name.');
  if (!dob)   return err('Enter the date of birth.');
  const cat = deriveCategoryFromDob(dob);
  if (!cat)   return err('Age is outside U-10 to U-16 for this meet.');
  if (!event) return err('Pick an event.');
  if (!phone) return err('Enter a parent phone number.');
  const ms = seedToMs(seedText);
  if (ms === undefined) return err('Seed time must look like 00:39.20, or NT for no time.');
  err('');

  const btn = $('manualModalSave');
  btn.disabled = true;

  // 1. The swimmer (entered by staff at the pool, so already verified)
  const { data: sw, error: swErr } = await window.sb.from('swimmers').insert({
    full_name: name, gender, date_of_birth: dob, category: cat.label,
    parent_phone: phone, academy_id: academy || null, status: 'APPROVED_ACTIVE',
  }).select('swimmer_id').single();
  if (swErr || !sw) { btn.disabled = false; return err(`Could not add the swimmer: ${swErr ? swErr.message : 'not allowed'}`); }

  // 2. Their entry in this meet
  const distance = parseInt(event, 10);
  const { error: enErr } = await window.sb.from('event_entries').insert({
    tournament_id: MEET.tournament_id, swimmer_id: sw.swimmer_id, event_name: event,
    stroke: event.replace(/^\d+m\s*/i, '') || null,
    distance: [25, 50, 100, 200, 400].includes(distance) ? distance : null,
    category: cat.label, gender, seed_time_ms: ms,
  });
  btn.disabled = false;
  if (enErr) {
    // Don't leave a swimmer behind with no entry
    await window.sb.from('swimmers').delete().eq('swimmer_id', sw.swimmer_id);
    return err(`Could not add the entry: ${enErr.message}`);
  }

  closeModal('manualEntryModal');
  showToast(`Added ${name} — ${event}`, 'success');
  loadRoster(MEET.tournament_id, true);
}

// ─── CSV export (Rule 7 Section A) ────────────────────────────
function exportCSV() {
  if (!ROSTER.length) { showToast('Nothing to export for this meet.', 'info'); return; }
  const headers = ['Row','Swimmer ID','Name','Gender','DOB','Age','Category','Academy','Event','Seed Time','Needs a look'];
  const rows = ROSTER.map((r, i) => [
    i + 1, r.swimId, r.name, r.gender, r.dob, r.age,
    `${r.gender === 'Girl' ? 'Girls' : 'Boys'} ${r.category}`, r.academy, r.event, r.seedTime,
    r.flags.map(f => f.msg).join('; '),
  ]);
  const csv  = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${String(MEET ? MEET.title : 'SwimFest').replace(/[^a-z0-9]+/gi, '_')}_player_list.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('Player list exported.', 'success');
}

// ─── Automated audit (Rule 7.3) ───────────────────────────────
function runAuditChecks() {
  const results = [];
  const withDob = ROSTER.filter(r => r.dob);
  const ageIssues = ROSTER.filter(r => r.flags.some(f => f.type === 'dob_conflict')).length;
  results.push({
    type: ageIssues ? 'warn' : 'ok', label: 'Age matches category',
    detail: ageIssues ? `${ageIssues} entr${ageIssues === 1 ? 'y is' : 'ies are'} in a category that doesn't match the swimmer's age.`
      : withDob.length ? 'Every swimmer is in the right age category.' : 'No dates of birth available to check.',
  });
  const genderIssues = ROSTER.filter(r => r.flags.some(f => f.type === 'gender')).length;
  results.push({
    type: genderIssues ? 'fail' : 'ok', label: 'Boys and girls in the right events',
    detail: genderIssues ? `${genderIssues} entr${genderIssues === 1 ? 'y is' : 'ies are'} in an event for the other gender.` : 'No cross-gender entries.',
  });
  const capIssues = new Set(ROSTER.filter(r => r.flags.some(f => f.type === 'cap')).map(r => r.swimmerId)).size;
  results.push({
    type: capIssues ? 'fail' : 'ok', label: `At most ${MAX_INDIVIDUAL_EVENTS} individual events each`,
    detail: capIssues ? `${capIssues} swimmer${capIssues === 1 ? ' is' : 's are'} over the limit.` : 'No swimmer is over the limit.',
  });
  const unverified = new Set(ROSTER.filter(r => r.status === 'PENDING_VERIFICATION').map(r => r.swimmerId)).size;
  if (unverified) results.push({ type: 'info', label: 'Unverified swimmers', detail: `${unverified} swimmer profile${unverified === 1 ? ' is' : 's are'} still waiting for approval.` });
  return results;
}

function renderAuditResults(results) {
  const icon = { ok: 'check-circle', warn: 'triangle-exclamation', fail: 'times-circle', info: 'info-circle' };
  $('auditResults').innerHTML = results.map(r => `
    <div class="pl-audit-row ${r.type}">
      <i class="fas fa-${icon[r.type]}"></i>
      <div><strong>${escHtml(r.label)}</strong> <span style="color:var(--ac-muted);">· ${escHtml(r.detail)}</span></div>
    </div>`).join('');
  $('auditResults').style.display = '';
}

// ─── Final lock (Rule 7.4) ────────────────────────────────────
function triggerFinalLock() {
  if (!MEET) return;
  const results = runAuditChecks();
  const hasFailures = results.some(r => r.type === 'fail');
  renderAuditResults(results);
  const uniqueSwimmers = new Set(ROSTER.map(r => r.swimmerId)).size;

  $('lockConfirmBody').innerHTML = `
    <p style="margin:0 0 10px;">Lock the player list for <strong>${escHtml(MEET.title)}</strong>?</p>
    <ul style="margin:0 0 10px;padding-left:18px;font-size:0.88rem;">
      <li><strong>${uniqueSwimmers}</strong> swimmers</li>
      <li><strong>${ROSTER.length}</strong> race entries</li>
    </ul>
    ${hasFailures ? '<p style="color:#b91c1c;font-weight:600;font-size:0.84rem;margin:0 0 8px;"><i class="fas fa-times-circle"></i> Fix the problems in the check before locking.</p>' : ''}
    <p style="color:var(--ac-muted);font-size:0.8rem;margin:0;">Entries become read-only and the meet moves on to heat generation. This can't be undone.</p>`;
  $('lockModalConfirm').disabled = hasFailures;
  $('lockModalConfirm').style.opacity = hasFailures ? '0.5' : '1';
  openModal('lockConfirmModal');
}

async function executeLock() {
  if (!MEET) return;
  const { data, error } = await window.sb.from('tournaments')
    .update({ status: 'LOCKED' }).eq('tournament_id', MEET.tournament_id).select('tournament_id');
  if (error || !data || !data.length) {
    showToast(error ? `Could not lock: ${error.message}` : 'Your account is not allowed to lock this meet.', 'warn');
    return;
  }
  closeModal('lockConfirmModal');
  MEET.status = 'LOCKED';
  renderStatus();
  renderGrid();
  showToast('Player list locked. Ready for heat generation.', 'success');
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const existing = document.querySelector('.admin-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'warn' ? 'exclamation-triangle' : 'info-circle';
  toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3200);
}

(function addToastStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .admin-toast {
      position: fixed; bottom: 28px; right: 28px; z-index: 99999;
      padding: 12px 20px; background: var(--dark); color: var(--white);
      border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 500;
      display: flex; align-items: center; gap: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      transform: translateY(20px); opacity: 0; transition: all 0.3s ease;
      max-width: 380px; font-family: 'Inter', sans-serif;
    }
    .admin-toast.show { transform: translateY(0); opacity: 1; }
    .admin-toast i { color: var(--accent); }
    .admin-toast.admin-toast-success i { color: var(--success); }
    .admin-toast.admin-toast-warn i { color: var(--warning); }
  `;
  document.head.appendChild(style);
})();

// ─── Bootstrap ────────────────────────────────────────────────
function refreshRosterLive() {
  // Don't disrupt an open modal or an inline edit
  if (document.hidden || !MEET) return;
  if (document.querySelector('.modal-overlay.active')) return;
  if (document.querySelector('tr.row-editing')) return;
  loadRoster(MEET.tournament_id, true);
}

document.addEventListener('DOMContentLoaded', () => {
  SESSION = window.SwimAuth ? window.SwimAuth.getSession() : null;
  renderSidebar();
  if (window.SwimNav) window.SwimNav.applySuperAdmin({ nav: 'plNav', brand: 'plBrand', brandSub: 'plBrandSub', userLink: 'plUserLink', name: 'plUserName', initials: 'plInitials', role: 'plUserRole' }, 'playerlist.html');
  renderStatus();
  renderGrid();
  loadAdminTournaments();
  setInterval(refreshRosterLive, 30000);   // pick up new registrations every 30s

  $('adminTournamentSelect').addEventListener('change', e => loadRoster(e.target.value));

  $('rosterSearch').addEventListener('input', renderGrid);
  $('rosterSearchClear').addEventListener('click', () => { $('rosterSearch').value = ''; renderGrid(); });
  ['filterCategory','filterGender','filterAcademy','filterFlag'].forEach(id => $(id).addEventListener('change', renderGrid));

  $('addManualBtn').addEventListener('click', openManualModal);
  $('manualModalClose').addEventListener('click',  () => closeModal('manualEntryModal'));
  $('manualModalCancel').addEventListener('click', () => closeModal('manualEntryModal'));
  $('mDob').addEventListener('change', updateManualDerived);
  $('mGender').addEventListener('change', updateManualDerived);
  $('manualModalSave').addEventListener('click', saveManualEntry);

  $('exportBtn').addEventListener('click', exportCSV);

  $('deleteModalClose').addEventListener('click',   () => closeModal('deleteModal'));
  $('deleteModalCancel').addEventListener('click',  () => closeModal('deleteModal'));
  $('deleteModalConfirm').addEventListener('click', confirmDelete);

  $('auditBtn').addEventListener('click', () => renderAuditResults(runAuditChecks()));
  $('submitFinalBtn').addEventListener('click', triggerFinalLock);
  $('lockModalClose').addEventListener('click',   () => closeModal('lockConfirmModal'));
  $('lockModalCancel').addEventListener('click',  () => closeModal('lockConfirmModal'));
  $('lockModalConfirm').addEventListener('click', executeLock);

  $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
  $('acScrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    setNavOpen(false);
    ['manualEntryModal', 'deleteModal', 'lockConfirmModal'].forEach(closeModal);
  });
});
