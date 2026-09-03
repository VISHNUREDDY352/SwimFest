/* ============================================================
   SwimFest — Master Player List Admin Console  (Chapter 7)
   admin.js
   ============================================================ */

'use strict';

// ─── Constants ────────────────────────────────────────────────
const TOURNAMENT_YEAR = 2026;

const CATEGORIES = [
  { label:'U-10', minAge:8,  maxAge:9  },
  { label:'U-12', minAge:10, maxAge:11 },
  { label:'U-14', minAge:12, maxAge:13 },
  { label:'U-16', minAge:14, maxAge:15 },
];

// Seed roster — multi-event bookings expanded into individual event-entry rows
// Each row = one swimmer × one event (Rule 7.1)
let ROSTER = [
  { id:'001', swimId:'SWM-2026-08492', name:'Arun Kumar',     gender:'Boy',  dob:'2015-05-14', age:11, category:'U-12', genderCat:'Boys',  academy:'Chennai Swim Club',  coach:'K. Ramesh',  event:'50m Freestyle',    seedTime:'00:39.20', flags:[], manual:false },
  { id:'002', swimId:'SWM-2026-08492', name:'Arun Kumar',     gender:'Boy',  dob:'2015-05-14', age:11, category:'U-12', genderCat:'Boys',  academy:'Chennai Swim Club',  coach:'K. Ramesh',  event:'100m Freestyle',   seedTime:'01:25.10', flags:[], manual:false },
  { id:'003', swimId:'SWM-2026-08492', name:'Arun Kumar',     gender:'Boy',  dob:'2015-05-14', age:11, category:'U-12', genderCat:'Boys',  academy:'Chennai Swim Club',  coach:'K. Ramesh',  event:'50m Backstroke',   seedTime:'NT',       flags:[], manual:false },
  { id:'004', swimId:'SWM-2026-09001', name:'Vikram Nair',    gender:'Boy',  dob:'2014-03-20', age:12, category:'U-12', genderCat:'Boys',  academy:'SRM Aquatics Academy',coach:'V. Anand',  event:'50m Freestyle',    seedTime:'NT',       flags:[{type:'dob_conflict', msg:'DOB Conflict → Auto-Assigned to U-14'}], manual:false },
  { id:'005', swimId:'SWM-2026-09201', name:'Karthik Raja',   gender:'Boy',  dob:'2017-01-10', age:9,  category:'U-10', genderCat:'Boys',  academy:'Aqua Stars Coimbatore',coach:'M. Vijay', event:'25m Freestyle',    seedTime:'00:21.50', flags:[], manual:false },
  { id:'006', swimId:'SWM-2026-09202', name:'Divya Mohan',    gender:'Girl', dob:'2014-07-22', age:11, category:'U-12', genderCat:'Girls', academy:'Aqua Stars Coimbatore',coach:'R. Kavitha',event:'50m Freestyle',   seedTime:'00:42.10', flags:[], manual:false },
  { id:'007', swimId:'SWM-2026-09202', name:'Divya Mohan',    gender:'Girl', dob:'2014-07-22', age:11, category:'U-12', genderCat:'Girls', academy:'Aqua Stars Coimbatore',coach:'R. Kavitha',event:'50m Breaststroke', seedTime:'00:51.30', flags:[], manual:false },
  { id:'008', swimId:'SWM-2026-09401', name:'Meera Shankar',  gender:'Girl', dob:'2010-11-05', age:15, category:'U-16', genderCat:'Girls', academy:'SDAT Academy Chennai', coach:'A. Selvakumar',event:'100m Freestyle', seedTime:'01:08.40', flags:[], manual:false },
  { id:'009', swimId:'SWM-2026-09401', name:'Meera Shankar',  gender:'Girl', dob:'2010-11-05', age:15, category:'U-16', genderCat:'Girls', academy:'SDAT Academy Chennai', coach:'A. Selvakumar',event:'200m Freestyle', seedTime:'NT',       flags:[], manual:false },
  { id:'010', swimId:'SWM-2026-09402', name:'Surya Prakash',  gender:'Boy',  dob:'2010-09-14', age:15, category:'U-16', genderCat:'Boys',  academy:'SDAT Academy Chennai', coach:'A. Selvakumar',event:'50m Butterfly',  seedTime:'00:31.80', flags:[], manual:false },
  { id:'011', swimId:'SWM-2026-09501', name:'Raj Pandian',    gender:'Boy',  dob:'2013-06-30', age:12, category:'U-14', genderCat:'Boys',  academy:'Madurai Aquatics',    coach:'S. Murugan',  event:'100m Backstroke',  seedTime:'01:18.60', flags:[], manual:false },
  { id:'012', swimId:'SWM-2026-08493', name:'Priya Suresh',   gender:'Girl', dob:'2012-02-18', age:13, category:'U-14', genderCat:'Girls', academy:'Chennai Swim Club',   coach:'S. Priya',    event:'50m Backstroke',   seedTime:'00:44.20', flags:[], manual:false },
  { id:'013', swimId:'SWM-2026-09203', name:'Arjun Selvam',   gender:'Boy',  dob:'2016-08-03', age:9,  category:'U-10', genderCat:'Boys',  academy:'Aqua Stars Coimbatore',coach:'M. Vijay', event:'25m Breaststroke',  seedTime:'00:28.90', flags:[], manual:false },
  { id:'014', swimId:'SWM-2026-09403', name:'Lakshmi Rao',    gender:'Girl', dob:'2012-12-09', age:13, category:'U-14', genderCat:'Girls', academy:'SDAT Academy Chennai', coach:'P. Dhanalakshmi',event:'100m Freestyle',seedTime:'01:12.30',flags:[], manual:false },
  { id:'015', swimId:'SWM-2026-08494', name:'Rahul Menon',    gender:'Boy',  dob:'2010-04-25', age:15, category:'U-16', genderCat:'Boys',  academy:'Chennai Swim Club',   coach:'K. Ramesh',   event:'200m Freestyle',   seedTime:'02:14.50', flags:[], manual:false },
];

// ROSTER starts empty; filled from Supabase for the selected tournament
ROSTER = [];

let isLocked        = false;
let pendingDeleteId = null;
let nextManualId    = 16;
let currentTournamentId = null;

// ─── Utilities ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Supabase: load tournaments into the selector ──────────────
async function loadAdminTournaments() {
  const sel = $('adminTournamentSelect');
  if (!sel || !window.sb) { if (sel) sel.innerHTML = '<option value="">DB not connected</option>'; return; }
  const { data, error } = await window.sb
    .from('tournaments')
    .select('tournament_id, title, status')
    .order('start_date', { ascending: false });
  if (error || !data || !data.length) { sel.innerHTML = '<option value="">No tournaments found</option>'; return; }
  sel.innerHTML = data.map(t => `<option value="${t.tournament_id}">${escHtml(t.title)} — ${t.status}</option>`).join('');
  sel.addEventListener('change', () => loadRoster(sel.value));

  // Honor ?t=<tournament_id> deep link (e.g. from EM/Org dashboard "Manage")
  const wanted = new URLSearchParams(location.search).get('t');
  if (wanted && data.some(t => t.tournament_id === wanted)) sel.value = wanted;

  await loadRoster(sel.value);
}

function msToSeed(ms) {
  if (!ms || ms <= 0) return 'NT';
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
  return `${String(min).padStart(2,'0')}:${sec}`;
}

// ── Supabase: load event_entries for a tournament into ROSTER ─
async function loadRoster(tournamentId, silent = false) {
  currentTournamentId = tournamentId || null;
  if (!window.sb || !tournamentId) { ROSTER = []; renderGrid(); return; }

  const { data, error } = await window.sb
    .from('event_entries')
    .select('entry_id, event_name, category, gender, seed_time_ms, swimmer_id')
    .eq('tournament_id', tournamentId);

  if (error) { console.error('[SwimFest] roster load:', error.message); ROSTER = []; renderGrid(); return; }
  if (!data || !data.length) { ROSTER = []; populateAcademyFilter(); renderGrid(); if (!silent) showToast('No entries for this tournament yet.', 'info'); return; }

  // Swimmer details from the public directory + swimmers table (DOB via directory not available; use entries)
  const swimmerIds = [...new Set(data.map(e => e.swimmer_id).filter(Boolean))];
  const nameMap = {};
  if (swimmerIds.length) {
    const { data: dir } = await window.sb
      .from('swimmer_directory').select('swimmer_id, full_name, academy_name').in('swimmer_id', swimmerIds);
    (dir || []).forEach(s => { nameMap[s.swimmer_id] = s; });
  }

  ROSTER = data.map((e, i) => {
    const s = nameMap[e.swimmer_id] || {};
    return {
      id: e.entry_id,
      swimId: e.swimmer_id ? String(e.swimmer_id).slice(0, 8) : '—',
      name: s.full_name || 'Unknown Swimmer',
      gender: e.gender,
      dob: '',
      age: '',
      category: e.category,
      genderCat: e.gender === 'Girl' ? 'Girls' : 'Boys',
      academy: s.academy_name || 'Unattached',
      coach: '—',
      event: e.event_name,
      seedTime: msToSeed(e.seed_time_ms),
      flags: [],
      manual: false,
    };
  });

  populateAcademyFilter();
  renderGrid();
  if (!silent) showToast(`Loaded ${ROSTER.length} entries.`, 'success');
}

// ── Supabase: lock the tournament (set status LOCKED) ─────────
async function lockTournamentInDB() {
  if (!window.sb || !currentTournamentId) return;
  const { error } = await window.sb.from('tournaments').update({ status: 'LOCKED' }).eq('tournament_id', currentTournamentId);
  if (error) console.error('[SwimFest] lock tournament:', error.message);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function deriveCategoryFromDob(dob) {
  if (!dob) return null;
  const age = TOURNAMENT_YEAR - new Date(dob).getFullYear();
  return CATEGORIES.find(c => age >= c.minAge && age <= c.maxAge) || null;
}

function formatDate(dob) {
  if (!dob) return '—';
  const [y, m, d] = dob.split('-');
  return `${d}/${m}/${y}`;
}

function openModal(id)  { const m=$(id); m.classList.add('active'); m.style.display='flex'; }
function closeModal(id) { const m=$(id); m.classList.remove('active'); m.style.display='none'; }

// ─── Stats Banner ─────────────────────────────────────────────
function updateBanner() {
  const uniqueSwimmers = new Set(ROSTER.map(r => r.swimId)).size;
  const flaggedCount   = ROSTER.filter(r => r.flags.length > 0).length;
  $('totalEntries').textContent  = uniqueSwimmers;
  $('totalEventRows').textContent = ROSTER.length;

  $('adminGridStats').innerHTML = `
    <div class="admin-stat-chip">
      <i class="fas fa-users"></i>
      <span class="chip-num">${uniqueSwimmers}</span>
      <span>Unique Swimmers</span>
    </div>
    <div class="admin-stat-chip">
      <i class="fas fa-list"></i>
      <span class="chip-num">${ROSTER.length}</span>
      <span>Event-Entry Rows</span>
    </div>
    <div class="admin-stat-chip chip-flagged">
      <i class="fas fa-exclamation-triangle"></i>
      <span class="chip-num">${flaggedCount}</span>
      <span>Flagged Entries</span>
    </div>
    <div class="admin-stat-chip">
      <i class="fas fa-check-circle" style="color:var(--success)"></i>
      <span class="chip-num" style="color:var(--success)">${ROSTER.length - flaggedCount}</span>
      <span>Clean Entries</span>
    </div>`;
}

// ─── Populate Academy Filter ──────────────────────────────────
function populateAcademyFilter() {
  const academies = [...new Set(ROSTER.map(r => r.academy).filter(Boolean))].sort();
  const sel = $('filterAcademy');
  sel.innerHTML = '<option value="">All Academies</option>';
  academies.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    sel.appendChild(opt);
  });
}

// ─── Filter Logic ─────────────────────────────────────────────
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
      || row.event.toLowerCase().includes(q);
    const matchCat    = !cat     || row.category === cat;
    const matchGender = !gender  || row.gender === gender;
    const matchAcad   = !academy || row.academy === academy;
    const matchFlag   = !flag
      || (flag === 'flagged' && row.flags.length > 0)
      || (flag === 'clean'   && row.flags.length === 0);
    return matchQ && matchCat && matchGender && matchAcad && matchFlag;
  });
}

// ─── Render Grid ──────────────────────────────────────────────
function renderGrid() {
  const rows   = getFilteredRoster();
  const tbody  = $('adminGridBody');
  const empty  = $('adminEmpty');
  const wrap   = $('adminGridWrap');

  tbody.innerHTML = '';

  if (rows.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  if (isLocked) wrap.classList.add('locked');
  else          wrap.classList.remove('locked');

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.rowId = row.id;
    if (row.flags.length > 0) tr.classList.add('row-flagged');

    const isNT        = row.seedTime?.toUpperCase() === 'NT';
    const flagsHtml   = row.flags.map(f =>
      `<div class="flag-badge"><i class="fas fa-exclamation-triangle"></i> ${escHtml(f.msg)}</div>`
    ).join('');
    const manualBadge = row.manual ? '<span class="manual-badge">Walk-in</span>' : '';

    tr.innerHTML = `
      <td><span class="row-num">${String(idx + 1).padStart(3,'0')}</span></td>
      <td>
        <div class="grid-swimmer-name">${escHtml(row.name)} ${manualBadge}</div>
        <div class="grid-swimmer-id">${escHtml(row.swimId)}</div>
        ${flagsHtml}
      </td>
      <td>
        <div class="grid-dob">${escHtml(row.gender)} / ${formatDate(row.dob)}</div>
        <div class="grid-age">Age: ${row.age}</div>
      </td>
      <td>
        <span class="grid-cat-pill ${row.gender === 'Girl' ? 'girls' : 'boys'}">
          ${escHtml(row.genderCat)} ${escHtml(row.category)}
        </span>
      </td>
      <td>
        <div class="grid-academy">${escHtml(row.academy)}</div>
        <div class="grid-coach">${escHtml(row.coach || '—')}</div>
      </td>
      <td>${escHtml(row.event)}</td>
      <td><span class="grid-seed${isNT ? ' nt' : ''}">${escHtml(row.seedTime || 'NT')}</span></td>
      <td>
        ${isLocked
          ? `<span style="font-size:0.72rem;color:var(--gray);font-style:italic;">Locked</span>`
          : `<div class="grid-action-group">
               <button class="admin-btn admin-btn-outline admin-btn-sm btn-edit" data-id="${row.id}">
                 <i class="fas fa-pen"></i> Edit
               </button>
               <button class="admin-btn admin-btn-danger admin-btn-sm btn-del" data-id="${row.id}">
                 <i class="fas fa-trash"></i> Del
               </button>
             </div>`
        }
      </td>`;

    // Edit / Delete handlers
    tr.querySelector('.btn-edit')?.addEventListener('click', () => startEdit(row.id, tr));
    tr.querySelector('.btn-del')?.addEventListener('click',  () => triggerDelete(row.id, row.name, row.event));

    tbody.appendChild(tr);
  });

  updateBanner();
}

// ─── Inline Edit (Rule 7.2) ───────────────────────────────────
function startEdit(rowId, tr) {
  const row = ROSTER.find(r => r.id === rowId);
  if (!row) return;
  tr.classList.add('row-editing');

  // Seed time cell
  const seedCell = tr.cells[6];
  seedCell.innerHTML = `
    <input type="text" class="grid-edit-input" id="editSeed_${rowId}"
           value="${escHtml(row.seedTime)}" placeholder="MM:SS.ms or NT" maxlength="10">`;

  // Category cell (override)
  const catCell = tr.cells[3];
  catCell.innerHTML = `
    <select class="grid-edit-select" id="editCat_${rowId}">
      ${CATEGORIES.map(c =>
        `<option value="${c.label}" ${row.category===c.label?'selected':''}>${row.gender==='Girl'?'Girls':'Boys'} ${c.label}</option>`
      ).join('')}
    </select>`;

  // Action cell → Save / Cancel
  const actCell = tr.cells[7];
  actCell.innerHTML = `
    <div class="grid-save-group">
      <button class="admin-btn admin-btn-primary admin-btn-sm btn-save" data-id="${rowId}">
        <i class="fas fa-check"></i> Save
      </button>
      <button class="admin-btn admin-btn-outline admin-btn-sm btn-cancel" data-id="${rowId}">
        <i class="fas fa-times"></i>
      </button>
    </div>`;

  actCell.querySelector('.btn-save').addEventListener('click', () => saveEdit(rowId));
  actCell.querySelector('.btn-cancel').addEventListener('click', () => renderGrid());
}

function saveEdit(rowId) {
  const row      = ROSTER.find(r => r.id === rowId);
  if (!row) return;
  const newSeed  = $(`editSeed_${rowId}`)?.value.trim() || row.seedTime;
  const newCat   = $(`editCat_${rowId}`)?.value        || row.category;

  // Validate seed time
  if (newSeed.toUpperCase() !== 'NT' && !/^\d{1,2}:\d{2}\.\d{1,2}$/.test(newSeed)) {
    alert('Invalid seed time. Use MM:SS.ms format (e.g. 00:39.20) or NT.');
    return;
  }

  row.seedTime = newSeed.toUpperCase() === 'NT' ? 'NT' : newSeed;
  row.category = newCat;
  row.genderCat = row.gender === 'Girl' ? 'Girls' : 'Boys';

  // Clear DOB-conflict flag if category was manually corrected
  row.flags = row.flags.filter(f => f.type !== 'dob_conflict');

  showToast(`Entry updated: ${row.name} — ${row.event}`);
  renderGrid();
}

// ─── Delete (Rule 7.2) ────────────────────────────────────────
function triggerDelete(rowId, name, event) {
  pendingDeleteId = rowId;
  $('deleteModalMsg').innerHTML =
    `Remove <strong>${escHtml(name)}</strong> — <em>${escHtml(event)}</em>?<br>
     <span style="font-size:0.8rem;color:var(--gray);">This will disqualify/purge the registration entry.</span>`;
  openModal('deleteModal');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  ROSTER = ROSTER.filter(r => r.id !== pendingDeleteId);
  pendingDeleteId = null;
  closeModal('deleteModal');
  populateAcademyFilter();
  showToast('Entry removed from roster.');
  renderGrid();
}

// ─── Manual Walk-In Entry (Rule 7.2) ─────────────────────────
function openManualModal() {
  // Populate academy dropdown
  const academySelect = $('mAcademy');
  academySelect.innerHTML = '<option value="">None / Unattached</option>';
  const academies = window.SWIMFEST_ACADEMIES || [];
  academies.filter(a => a.status === 'Active').forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.academy_name;
    opt.textContent = `${a.academy_name} (${a.city})`;
    academySelect.appendChild(opt);
  });

  // Reset fields
  ['mFullName','mDob','mSeedTime','mContact'].forEach(id => { if($(id)) $(id).value = ''; });
  $('mGender').value  = 'Boy';
  $('mAcademy').value = '';
  $('mEvent').value   = '';
  $('mDerivedRow').style.display = 'none';

  openModal('manualEntryModal');
}

function updateManualDerived() {
  const dob = $('mDob').value;
  if (!dob) { $('mDerivedRow').style.display = 'none'; return; }
  const cat = deriveCategoryFromDob(dob);
  const yob = new Date(dob).getFullYear();
  const age = TOURNAMENT_YEAR - yob;

  if (!cat) { $('mDerivedRow').style.display = 'none'; return; }

  const gender   = $('mGender').value;
  $('mYob').textContent      = yob;
  $('mAge').textContent      = age;
  $('mCategory').textContent = `${gender === 'Girl' ? 'GIRLS' : 'BOYS'} ${cat.label}`;
  $('mDerivedRow').style.display = '';

  // Populate event dropdown
  const EVENT_MASTER = window.SWIMFEST_EVENT_MASTER || getEventMasterLocal();
  const events = EVENT_MASTER.filter(e => e.gender === gender && e.category === cat.label);
  const evSel  = $('mEvent');
  evSel.innerHTML = '<option value="">— Select Event —</option>';
  events.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.name; opt.textContent = e.name;
    evSel.appendChild(opt);
  });
}

function getEventMasterLocal() {
  // Fallback mini list used if register.js isn't loaded
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

function saveManualEntry() {
  const name     = $('mFullName').value.trim();
  const gender   = $('mGender').value;
  const dob      = $('mDob').value;
  const academy  = $('mAcademy').value;
  const event    = $('mEvent').value;
  const seedTime = $('mSeedTime').value.trim() || 'NT';
  const contact  = $('mContact').value.trim();

  // Validation
  if (!name)  { alert('Full name is required.'); return; }
  if (!dob)   { alert('Date of birth is required.'); return; }
  if (!event) { alert('Please select an event.'); return; }

  const cat = deriveCategoryFromDob(dob);
  if (!cat) { alert('Age not within eligible range (U-10 to U-16).'); return; }

  if (seedTime.toUpperCase() !== 'NT' && !/^\d{1,2}:\d{2}\.\d{1,2}$/.test(seedTime)) {
    alert('Invalid seed time. Use MM:SS.ms or NT.'); return;
  }

  const yob = new Date(dob).getFullYear();
  const age = TOURNAMENT_YEAR - yob;
  const id  = String(nextManualId++).padStart(3,'0');
  const swimId = `SWM-${TOURNAMENT_YEAR}-WALK${id}`;

  const coaches = window.SWIMFEST_COACHES || [];
  const academies = window.SWIMFEST_ACADEMIES || [];
  const acObj = academies.find(a => a.academy_name === academy);
  const linkedCoach = acObj
    ? coaches.find(c => c.academy_id === acObj.academy_id && c.designation === 'Head Coach')
    : null;

  ROSTER.push({
    id, swimId, name, gender, dob, age,
    category   : cat.label,
    genderCat  : gender === 'Girl' ? 'Girls' : 'Boys',
    academy    : academy || 'None / Unattached',
    coach      : linkedCoach ? linkedCoach.full_name : '—',
    event, seedTime: seedTime.toUpperCase() === 'NT' ? 'NT' : seedTime,
    flags  : [],
    manual : true,
    contact,
  });

  closeModal('manualEntryModal');
  populateAcademyFilter();
  showToast(`Walk-in entry added: ${name} — ${event}`);
  renderGrid();
}

// ─── CSV Export (Rule 7 Section A) ───────────────────────────
function exportCSV() {
  const headers = ['Row','Swimmer ID','Name','Gender','DOB','Age','Category','Academy','Coach','Event','Seed Time','Flags'];
  const rows = ROSTER.map((r, i) => [
    i + 1,
    r.swimId,
    r.name,
    r.gender,
    r.dob,
    r.age,
    `${r.genderCat} ${r.category}`,
    r.academy,
    r.coach,
    r.event,
    r.seedTime,
    r.flags.map(f => f.msg).join('; '),
  ]);

  const csv    = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob   = new Blob([csv], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `SwimFest_MasterRoster_${TOURNAMENT_YEAR}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Roster exported as CSV.');
}

// ─── Automated Audit (Rule 7.3) ───────────────────────────────
function runAuditChecks() {
  const results = [];

  // 1. Age-Category Alignment
  const ageMismatches = ROSTER.filter(r => {
    const cat = deriveCategoryFromDob(r.dob);
    return !cat || cat.label !== r.category;
  });
  results.push({
    type  : ageMismatches.length === 0 ? 'ok' : 'warn',
    label : 'Age-Category Alignment',
    detail: ageMismatches.length === 0
      ? 'All DOBs align with assigned categories.'
      : `${ageMismatches.length} entry(ies) have age-category mismatches.`,
    count : ageMismatches.length,
  });

  // 2. Gender Isolation
  const genderViolations = ROSTER.filter(r => {
    const eventHasGender = r.event && r.genderCat;
    const isOk = (r.gender === 'Boy'  && r.genderCat === 'Boys')
              || (r.gender === 'Girl' && r.genderCat === 'Girls');
    return !isOk;
  });
  results.push({
    type  : genderViolations.length === 0 ? 'ok' : 'fail',
    label : 'Gender Isolation Verification',
    detail: genderViolations.length === 0
      ? 'No gender cross-entries detected.'
      : `${genderViolations.length} gender violation(s) found.`,
    count : genderViolations.length,
  });

  // 3. Event Cap (max 3 individual events per swimmer)
  const swimmerEventCount = {};
  ROSTER.forEach(r => {
    swimmerEventCount[r.swimId] = (swimmerEventCount[r.swimId] || 0) + 1;
  });
  const capViolations = Object.entries(swimmerEventCount).filter(([, n]) => n > 3);
  results.push({
    type  : capViolations.length === 0 ? 'ok' : 'fail',
    label : 'Event Cap Verification (max 3)',
    detail: capViolations.length === 0
      ? 'No swimmer exceeds 3 individual events.'
      : `${capViolations.length} swimmer(s) exceed the 3-event cap.`,
    count : capViolations.length,
  });

  return results;
}

function renderAuditResults(results) {
  const panel = $('auditResults');
  panel.innerHTML = `
    <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--gray);margin-bottom:10px;">
      Automated Roster Audit — ${new Date().toLocaleTimeString()}
    </div>
    ${results.map(r => `
      <div class="audit-result-row audit-${r.type}">
        <i class="fas fa-${r.type === 'ok' ? 'check-circle' : r.type === 'warn' ? 'exclamation-triangle' : 'times-circle'}"></i>
        <div>
          <strong style="font-size:0.82rem;">${escHtml(r.label)}</strong>
          <span style="font-size:0.78rem;color:var(--gray);margin-left:8px;">${escHtml(r.detail)}</span>
        </div>
      </div>`).join('')}`;
  panel.style.display = '';
}

// ─── Final Lock (Rule 7.4) ────────────────────────────────────
function triggerFinalLock() {
  const auditResults  = runAuditChecks();
  const hasFailures   = auditResults.some(r => r.type === 'fail');
  const hasWarnings   = auditResults.some(r => r.type === 'warn');

  renderAuditResults(auditResults);

  const uniqueSwimmers = new Set(ROSTER.map(r => r.swimId)).size;

  $('lockConfirmBody').innerHTML = `
    <p style="margin-bottom:12px;">You are about to <span class="warn-text">permanently lock</span> the player list for:</p>
    <p style="font-weight:700;font-size:0.95rem;margin-bottom:16px;">Golden Non-Medalist Championship 2026</p>
    <ul>
      <li><strong>${uniqueSwimmers}</strong> unique swimmers</li>
      <li><strong>${ROSTER.length}</strong> event-entry rows</li>
      <li>Tournament state → <code>PLAYER_LIST_LOCKED</code></li>
    </ul>
    ${hasFailures ? `<p style="color:var(--danger);font-weight:600;margin-top:12px;font-size:0.82rem;"><i class="fas fa-times-circle"></i> Audit failures detected. Resolve before locking.</p>` : ''}
    ${hasWarnings && !hasFailures ? `<p style="color:var(--warning);font-weight:600;margin-top:12px;font-size:0.82rem;"><i class="fas fa-exclamation-triangle"></i> Warnings found — you may still proceed.</p>` : ''}
    <p style="color:var(--gray);font-size:0.78rem;margin-top:12px;"><i class="fas fa-info-circle"></i> This action cannot be undone. All entries become read-only and are handed off to the Heat Generation Engine.</p>`;

  const confirmBtn = $('lockModalConfirm');
  confirmBtn.disabled = hasFailures;
  confirmBtn.style.opacity = hasFailures ? '0.5' : '1';

  openModal('lockConfirmModal');
}

async function executeLock() {
  isLocked = true;
  await lockTournamentInDB();
  closeModal('lockConfirmModal');

  // Update UI
  $('regStatusChip').className = 'admin-status-chip locked';
  $('regStatusChip').innerHTML = '<i class="fas fa-lock"></i> Player List Locked';
  $('lockStatusItem').style.display = '';

  $('lockBlock').querySelector('.admin-lock-warning').style.display = 'none';
  $('lockBlock').querySelector('.admin-audit-results').style.display = 'none';
  $('lockBlock').querySelector('.admin-lock-actions').style.display  = 'none';
  $('lockedState').style.display = '';

  $('adminGridWrap').classList.add('locked');
  $('addManualBtn').disabled = true;
  $('addManualBtn').style.opacity = '0.5';

  showToast('Player list locked. Data handed off to Heat Generation Engine.', 'success');
  renderGrid();
}

// ─── Draft Save ───────────────────────────────────────────────
function saveDraft() {
  runAuditChecks();
  renderAuditResults(runAuditChecks());
  showToast('Draft saved. Pending edits persisted (no heat sheet generated).');
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const existing = document.querySelector('.admin-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3200);
}

// Add toast CSS dynamically
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
  `;
  document.head.appendChild(style);
})();

// ─── Bootstrap ────────────────────────────────────────────────
function refreshRosterLive() {
  // Don't disrupt an open modal, an inline edit, or a locked list
  if (isLocked) return;
  if (document.querySelector('.modal-overlay.active')) return;
  if (document.querySelector('tr.row-editing')) return;
  if (!currentTournamentId) return;
  loadRoster(currentTournamentId, true);  // silent — no toast spam
}

document.addEventListener('DOMContentLoaded', () => {
  populateAcademyFilter();
  updateBanner();
  renderGrid();
  loadAdminTournaments();  // replace seed ROSTER with real event_entries
  setInterval(refreshRosterLive, 3000);  // auto-refresh roster every 3s

  // Search
  $('rosterSearch').addEventListener('input', renderGrid);
  $('rosterSearchClear').addEventListener('click', () => { $('rosterSearch').value = ''; renderGrid(); });

  // Filters
  ['filterCategory','filterGender','filterAcademy','filterFlag'].forEach(id =>
    $(id).addEventListener('change', renderGrid));

  // Add manual
  $('addManualBtn').addEventListener('click', openManualModal);
  $('manualModalClose').addEventListener('click',  () => closeModal('manualEntryModal'));
  $('manualModalCancel').addEventListener('click', () => closeModal('manualEntryModal'));
  $('manualEntryModal').addEventListener('click',  e => { if (e.target === $('manualEntryModal')) closeModal('manualEntryModal'); });

  // Manual form — live derive
  $('mDob').addEventListener('change', updateManualDerived);
  $('mGender').addEventListener('change', updateManualDerived);
  $('manualModalSave').addEventListener('click', saveManualEntry);

  // Export
  $('exportBtn').addEventListener('click', exportCSV);

  // Delete modal
  $('deleteModalClose').addEventListener('click',   () => closeModal('deleteModal'));
  $('deleteModalCancel').addEventListener('click',  () => closeModal('deleteModal'));
  $('deleteModalConfirm').addEventListener('click', confirmDelete);
  $('deleteModal').addEventListener('click', e => { if (e.target === $('deleteModal')) closeModal('deleteModal'); });

  // Draft save
  $('saveDraftBtn').addEventListener('click', saveDraft);

  // Final lock
  $('submitFinalBtn').addEventListener('click', triggerFinalLock);
  $('lockModalClose').addEventListener('click',   () => closeModal('lockConfirmModal'));
  $('lockModalCancel').addEventListener('click',  () => closeModal('lockConfirmModal'));
  $('lockModalConfirm').addEventListener('click', executeLock);
  $('lockConfirmModal').addEventListener('click', e => { if (e.target === $('lockConfirmModal')) closeModal('lockConfirmModal'); });
});
