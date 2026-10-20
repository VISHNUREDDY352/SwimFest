/* ============================================================
   SwimFest — Live Results (Chapter 9)
   results.js
   Times are typed per lane (or loaded from a result-sheet CSV),
   saved to heat_rows, then published per event: cross-heat ranks
   and academy points are written back to heat_rows.
   ============================================================ */

'use strict';

// ─── DQ Fault Codes (Rule 9.2) ────────────────────────────────
const DQ_CODES = {
  'FS': 'FS — False start',
  'IT': 'IT — Illegal turn',
  'IS': 'IS — Illegal stroke',
  'IK': 'IK — Illegal kick',
  'OT': 'OT — One-hand touch',
  'LV': 'LV — Lane violation',
  'ET': 'ET — Relay early takeoff',
};
const STATUSES = { OK: 'OK', DNS: 'DNS — did not start', DNF: 'DNF — did not finish', DQ: 'DQ — disqualified' };

// ─── Academy Points Scale (Rule 9.4) ──────────────────────────
const INDIV_POINTS = { 1:9, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1 };
const RELAY_POINTS = { 1:18, 2:14, 3:12, 4:10, 5:8, 6:6, 7:4, 8:2 };
const MAX_SCORERS_PER_ACADEMY = 2; // Individual cap (Rule 9.4)

// Approved meets only; results are read-only once closure starts
const MEET_STATUSES = ['PUBLISHED', 'CLOSED', 'LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'];
const READ_ONLY_STATUSES = ['CLOSURE_REQUESTED', 'COMPLETED'];
const STATUS_PILL = {
  PUBLISHED: ['Registration open', 'ac-pill-live'],
  CLOSED: ['Registration closed', 'ac-pill-wait'],
  LOCKED: ['Racing', 'ac-pill-live'],
  CLOSURE_REQUESTED: ['Closure requested', 'ac-pill-wait'],
  COMPLETED: ['Completed', 'ac-pill-done'],
};

let SESSION = null;
let MEETS = [];
let MEET = null;
let EVENTS = [];             // [{ key, num, name, category, gender, pool, isRelay, heats:[{ heatNo, lanes:[…] }] }]
const edits = new Map();     // heatRowId → { time:'text', status, dq }   (not yet saved)
const state = { evIdx: 0, heatIdx: 0, mode: 'type' };

// ─── Utilities ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtTime(ms) {
  if (ms == null || ms <= 0) return '';
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
  return `${String(min).padStart(2,'0')}:${sec}`;
}

// "00:39.20" / "0:39.2" / "39.20" → ms; blank → null; anything else → undefined
function parseTime(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const m = /^(?:(\d{1,2}):)?(\d{1,2})\.(\d{1,2})$/.exec(t);
  if (!m) return undefined;
  if (m[1] != null && m[2].length !== 2) return undefined;   // 1:5.20 is ambiguous
  if (Number(m[2]) > 59 && m[1] != null) return undefined;
  const frac = m[3].length === 1 ? Number(m[3]) * 100 : Number(m[3]) * 10;
  return Number(m[1] || 0) * 60000 + Number(m[2]) * 1000 + frac;
}

function eventTitle(ev) {
  return `${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category} ${ev.name}`;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function openModal(id)  { const m=$(id); m.classList.add('active'); m.style.display='flex'; }
function closeModal(id) { const m=$(id); m.classList.remove('active'); m.style.display='none'; }

function isReadOnly() { return !MEET || READ_ONLY_STATUSES.includes(MEET.status); }

// Current value of a lane: the unsaved edit if there is one, else what's saved
function laneValue(lane) {
  return edits.get(lane.heatRowId)
    || { time: fmtTime(lane.saved.time), status: lane.saved.status, dq: lane.saved.dq };
}

// A lane has a result once it has a valid time or a DNS/DNF/DQ status
function hasResult(v) {
  if (v.status === 'OK') { const ms = parseTime(v.time); return ms != null && ms !== undefined; }
  return true;
}

function laneProblem(lane, v) {
  const ms = parseTime(v.time);
  if (ms === undefined) return `L${lane.lane} ${lane.name}: "${v.time}" isn't a time (use MM:SS.ss)`;
  if (v.status === 'DQ' && !v.dq) return `L${lane.lane} ${lane.name}: DQ without a fault code`;
  return null;
}

function isPublished(ev) {
  return ev.heats.some(h => h.lanes.some(l => l.swimId && l.rank != null));
}

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
    $('lrBrand').setAttribute('href', 'orgdashboard.html');
    $('lrBrandSub').textContent = 'Organizer Dashboard';
    html = sideGroup('', [
        sideLink('orgdashboard.html', 'table-columns', 'Overview'),
        sideLink('orgdashboard.html#myMeets', 'trophy', 'My meets'),
      ])
      + sideGroup('Run a meet', [
        sideLink('orgracecontrol.html', 'flag-checkered', 'Race control'),
        sideLink('playerlist.html', 'list-check', 'Player list'),
        sideLink('results.html', 'broadcast-tower', 'Live results', true),
      ])
      + sideGroup('Create', [sideLink('orgcreate.html', 'plus', 'Create event')]);
    // The name at the bottom opens the organization profile
    $('lrUserLink').setAttribute('href', 'orgprofile.html');
    $('lrUserLink').title = 'Organization profile';
  } else {
    html = sideGroup('', [
        sideLink('admin.html', 'table-columns', 'Overview'),
        sideLink('admin.html#verificationQueues', 'clipboard-check', 'Approvals'),
      ])
      + sideGroup('Meets', [
        sideLink('admin.html#myMeets', 'trophy', 'My meets'),
        sideLink('playerlist.html', 'list-check', 'Player list'),
        sideLink('heatgen.html', 'bolt', 'Heat generation'),
        sideLink('results.html', 'broadcast-tower', 'Live results', true),
        sideLink('racecontrol.html', 'flag-checkered', 'Race control'),
      ])
      + sideGroup('Create', [sideLink('addevent.html', 'plus', 'Add event')]);
  }
  $('lrNav').innerHTML = html;

  if (SESSION) {
    const name = SESSION.name || SESSION.email || 'Signed in';
    $('lrUserName').textContent = name;
    $('lrUserRole').textContent = { organizer: 'Organizer', event_manager: 'Event Manager', super_admin: 'Super Admin' }[role] || '';
    $('lrInitials').textContent = String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SF';
  }
}

function setNavOpen(open) {
  $('acShell').classList.toggle('nav-open', open);
  $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ─── Supabase: meets for the picker ───────────────────────────
// Organizers see only meets they created; staff see every approved meet.
async function loadResultTournaments() {
  const sel = $('resTournamentSelect');
  if (!window.sb) { sel.innerHTML = '<option value="">Database not connected</option>'; return; }
  let query = window.sb.from('tournaments')
    .select('tournament_id, title, status, start_date, lane_count')
    .in('status', MEET_STATUSES)
    .order('start_date', { ascending: false });
  if (SESSION && SESSION.role === 'organizer') query = query.eq('created_by', SESSION.userId);
  const { data, error } = await query;
  if (error || !data || !data.length) {
    if (error) console.error('[SwimFest] results meets:', error.message);
    sel.innerHTML = `<option value="">${error ? 'Could not load meets' : 'No approved meets yet'}</option>`;
    sel.disabled = true;
    MEET = null; EVENTS = []; renderAll();
    return;
  }
  MEETS = data;
  const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
  sel.innerHTML = data.map(t => `<option value="${t.tournament_id}">${escHtml(t.title)}${t.start_date ? ' · ' + fmt(t.start_date) : ''}</option>`).join('');

  // Honor ?t=<tournament_id> deep links; otherwise prefer a meet that is racing
  const wanted = new URLSearchParams(location.search).get('t');
  const pick = data.find(t => t.tournament_id === wanted)
    || data.find(t => t.status === 'LOCKED')
    || data[0];
  sel.value = pick.tournament_id;
  await loadResultsForTournament(pick.tournament_id);
}

// heat_rows can exceed one page (1000 rows) on big meets
async function fetchAllHeatRows(tournamentId) {
  const PAGE = 1000, rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await window.sb.from('heat_rows')
      .select(`heat_row_id, pool_label, event_no, heat_number, lane_number,
               finish_time_ms, status, dq_code, official_rank, points_awarded,
               event_entries ( event_name, category, gender, seed_time_ms, swimmer_id, is_relay )`)
      .eq('tournament_id', tournamentId)
      .order('event_no').order('heat_number').order('lane_number')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

// ─── Supabase: heat_rows → EVENTS ─────────────────────────────
async function loadResultsForTournament(tournamentId) {
  MEET = MEETS.find(t => t.tournament_id === tournamentId) || null;
  EVENTS = []; edits.clear();
  state.evIdx = 0; state.heatIdx = 0;
  $('resultGridBody').innerHTML = '<tr><td colspan="6" class="ac-empty-cell">Loading heats…</td></tr>';
  renderStatus();
  if (!window.sb || !MEET) { renderAll(); return; }

  let data;
  try { data = await fetchAllHeatRows(tournamentId); }
  catch (e) {
    console.error('[SwimFest] results load:', e.message);
    showToast('Could not load heats: ' + e.message, 'warn');
    renderAll(); return;
  }

  // Swimmer names + academies via the public directory view (chunked for URL length)
  const ids = [...new Set(data.map(r => r.event_entries && r.event_entries.swimmer_id).filter(Boolean))];
  const people = {};
  for (let i = 0; i < ids.length; i += 150) {
    const { data: dir } = await window.sb.from('swimmer_directory')
      .select('swimmer_id, full_name, academy_name').in('swimmer_id', ids.slice(i, i + 150));
    (dir || []).forEach(s => { people[s.swimmer_id] = s; });
  }

  const laneCount = MEET.lane_count || 8;
  const evMap = new Map();
  data.forEach(r => {
    const ee = r.event_entries || {};
    const key = `${r.pool_label || ''}|${r.event_no}|${ee.category}|${ee.gender}|${ee.event_name}`;
    if (!evMap.has(key)) {
      evMap.set(key, {
        key, num: r.event_no, name: ee.event_name || 'Event', category: ee.category || '—',
        gender: ee.gender || 'Boy', pool: r.pool_label || 'Pool', isRelay: !!ee.is_relay, _heats: new Map(),
      });
    }
    const ev = evMap.get(key);
    if (!ev._heats.has(r.heat_number)) ev._heats.set(r.heat_number, []);
    const p = people[ee.swimmer_id] || {};
    ev._heats.get(r.heat_number).push({
      lane: r.lane_number, heatRowId: r.heat_row_id, swimId: ee.swimmer_id,
      name: p.full_name || 'Unknown swimmer', academy: p.academy_name || 'Unattached',
      seedMs: ee.seed_time_ms,
      saved: { time: r.finish_time_ms, status: r.status || 'OK', dq: r.dq_code || '' },
      rank: r.official_rank, points: r.points_awarded || 0,
    });
  });

  EVENTS = [...evMap.values()].sort((a, b) => a.num - b.num || a.pool.localeCompare(b.pool)).map(ev => {
    const heatNos = [...ev._heats.keys()].sort((a, b) => a - b);
    ev.heats = heatNos.map(hn => {
      const rows = ev._heats.get(hn);
      const total = Math.max(laneCount, ...rows.map(x => x.lane));
      const lanes = [];
      for (let l = 1; l <= total; l++) lanes.push(rows.find(x => x.lane === l) || { lane: l, swimId: null });
      return { heatNo: hn, lanes };
    });
    delete ev._heats;
    return ev;
  });

  // Open on the first event that still needs times
  const firstOpen = EVENTS.findIndex(ev => ev.heats.some(h => h.lanes.some(l => l.swimId && !hasResult(laneValue(l)))));
  state.evIdx = firstOpen >= 0 ? firstOpen : 0;
  const ev = EVENTS[state.evIdx];
  const openHeat = ev ? ev.heats.findIndex(h => h.lanes.some(l => l.swimId && !hasResult(laneValue(l)))) : -1;
  state.heatIdx = openHeat >= 0 ? openHeat : 0;
  renderAll();
}

// ─── Rendering ────────────────────────────────────────────────
function renderAll() {
  renderStatus();
  renderMetrics();
  renderEventPicker();
  renderHeatChips();
  renderGrid();
  renderResultSheet();
  renderFooter();
}

function renderStatus() {
  const chip = $('meetStatusChip');
  const [label, cls] = MEET ? (STATUS_PILL[MEET.status] || [MEET.status, 'ac-pill-draft']) : ['—', 'ac-pill-draft'];
  chip.className = `ac-pill ${cls}`;
  chip.textContent = label;

  const ro = MEET && READ_ONLY_STATUSES.includes(MEET.status);
  $('readOnlyBanner').style.display = ro ? '' : 'none';
  if (ro) {
    $('readOnlyText').textContent = MEET.status === 'COMPLETED'
      ? 'This meet is completed, so results are read-only. Ask the super admin to reopen it if something needs fixing.'
      : 'Closure has been requested for this meet, so results are read-only while the super admin reviews it.';
  }
}

function renderMetrics() {
  const heats = EVENTS.flatMap(ev => ev.heats);
  const occupied = heats.flatMap(h => h.lanes.filter(l => l.swimId));
  // Counts saved results only, not unsaved edits
  const doneHeats = heats.filter(h => h.lanes.some(l => l.swimId)
    && h.lanes.every(l => !l.swimId || hasResult({ time: fmtTime(l.saved.time), status: l.saved.status })));
  $('statEvents').textContent = MEET ? EVENTS.length : '—';
  $('statHeats').textContent = MEET ? `${doneHeats.length} / ${heats.length}` : '—';
  $('statPublished').textContent = MEET ? `${EVENTS.filter(isPublished).length} / ${EVENTS.length}` : '—';
  $('statSwims').textContent = MEET ? occupied.length : '—';
}

function renderEventPicker() {
  const sel = $('eventSelector');
  if (!EVENTS.length) {
    sel.innerHTML = '<option value="">No events</option>';
    sel.disabled = true;
  } else {
    sel.disabled = false;
    sel.innerHTML = EVENTS.map((ev, i) => {
      const done = isPublished(ev) ? ' ✓ published' : '';
      return `<option value="${i}" ${i === state.evIdx ? 'selected' : ''}>Event ${ev.num} · ${escHtml(eventTitle(ev))} · ${escHtml(ev.pool)}${done}</option>`;
    }).join('');
  }
  $('prevEventBtn').disabled = state.evIdx <= 0;
  $('nextEventBtn').disabled = state.evIdx >= EVENTS.length - 1;
}

function renderHeatChips() {
  const box = $('heatChips');
  const ev = EVENTS[state.evIdx];
  if (!ev) { box.style.display = 'none'; return; }
  box.style.display = '';
  box.innerHTML = '<span class="lr-heats-label">Heats</span>' + ev.heats.map((h, i) => {
    const occ = h.lanes.filter(l => l.swimId);
    const done = occ.length && occ.every(l => hasResult(laneValue(l)));
    const dirty = occ.some(l => edits.has(l.heatRowId));
    const cls = i === state.heatIdx ? 'active' : done ? 'done' : '';
    return `<button type="button" class="lr-heat ${cls}" data-heat="${i}">
      ${done ? '<i class="fas fa-check"></i>' : ''} Heat ${h.heatNo}${dirty ? '<span class="dirty" title="Unsaved changes"></span>' : ''}</button>`;
  }).join('');
}

function renderGrid() {
  const tbody = $('resultGridBody');
  const ev = EVENTS[state.evIdx];
  if (!ev) {
    const msg = !MEET ? 'Pick a meet to enter results.'
      : (SESSION && SESSION.role === 'organizer')
        ? 'No heats yet. The Event Manager generates heats after the player list is locked.'
        : 'No heats yet. Generate them from Heat generation once the player list is locked.';
    tbody.innerHTML = `<tr><td colspan="6" class="ac-empty-cell">${msg}</td></tr>`;
    $('entryTitle').textContent = 'Enter times';
    $('entrySub').textContent = 'Pick an event and heat, then type each lane\'s finish time';
    return;
  }
  const heat = ev.heats[state.heatIdx];
  $('entryTitle').textContent = `Event ${ev.num} · ${eventTitle(ev)}`;
  $('entrySub').textContent = `${ev.pool} · Heat ${heat.heatNo} of ${ev.heats.length}${ev.isRelay ? ' · Relay' : ''}`;
  const ro = isReadOnly();

  tbody.innerHTML = heat.lanes.map(lane => {
    if (!lane.swimId) {
      return `<tr class="lr-empty-lane"><td><span class="lr-lane">L${lane.lane}</span></td><td colspan="5">Empty lane</td></tr>`;
    }
    const v = laneValue(lane);
    const ms = parseTime(v.time);
    const out = v.status === 'DNS' || v.status === 'DNF';
    const rowCls = [v.status === 'DQ' ? 'lr-row-dq' : out ? 'lr-row-out' : '', edits.has(lane.heatRowId) ? 'lr-row-dirty' : ''].join(' ');
    const timeCls = ms === undefined ? 'bad' : ms != null ? 'ok' : '';
    const statusOpts = Object.entries(STATUSES).map(([k, t]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${t}</option>`).join('');
    const dqOpts = '<option value="">— Code —</option>' + Object.entries(DQ_CODES).map(([k, t]) => `<option value="${k}" ${v.dq === k ? 'selected' : ''}>${t}</option>`).join('');
    return `<tr class="${rowCls}" data-id="${lane.heatRowId}">
      <td><span class="lr-lane">L${lane.lane}</span></td>
      <td><div class="lr-name">${escHtml(lane.name)}</div><div class="lr-sub">${escHtml(lane.academy)}</div></td>
      <td class="lr-sub" style="font-variant-numeric:tabular-nums;">${fmtTime(lane.seedMs) || 'NT'}</td>
      <td><input type="text" class="lr-input ${timeCls}" data-field="time" value="${escHtml(out ? '' : v.time)}" placeholder="MM:SS.ss"
            maxlength="9" inputmode="decimal" aria-label="Finish time lane ${lane.lane}" ${out || ro ? 'disabled' : ''}></td>
      <td><select class="lr-pick" data-field="status" aria-label="Status lane ${lane.lane}" ${ro ? 'disabled' : ''}>${statusOpts}</select></td>
      <td><select class="lr-pick" data-field="dq" aria-label="DQ code lane ${lane.lane}" ${v.status !== 'DQ' || ro ? 'disabled' : ''}>${dqOpts}</select></td>
    </tr>`;
  }).join('');
}

function renderFooter() {
  const ev = EVENTS[state.evIdx];
  const ro = isReadOnly();
  const note = $('entriesCount');
  if (!ev) { note.textContent = '—'; note.className = 'lr-foot-note'; }
  else {
    const occ = ev.heats[state.heatIdx].lanes.filter(l => l.swimId);
    const done = occ.filter(l => hasResult(laneValue(l))).length;
    if (edits.size) {
      note.className = 'lr-foot-note dirty';
      note.innerHTML = `<i class="fas fa-circle-exclamation"></i> ${edits.size} unsaved change${edits.size === 1 ? '' : 's'} · ${done} / ${occ.length} lanes in this heat have a result`;
    } else {
      note.className = 'lr-foot-note';
      note.innerHTML = `<i class="fas fa-circle-check" style="color:#16a34a;"></i> All saved · ${done} / ${occ.length} lanes in this heat have a result`;
    }
  }
  $('saveHeatBtn').disabled = ro || !edits.size;
  $('saveHeatBtn').innerHTML = `<i class="fas fa-floppy-disk"></i> Save${edits.size ? ` (${edits.size})` : ''}`;
  $('publishResultsBtn').disabled = ro || !ev;
  $('publishResultsBtn').innerHTML = ev && isPublished(ev)
    ? '<i class="fas fa-rotate"></i> Re-publish event'
    : '<i class="fas fa-paper-plane"></i> Publish event results';
}

function renderResultSheet() {
  const ev = EVENTS[state.evIdx];
  const card = $('resultSheetCard');
  if (!ev || !isPublished(ev)) { card.style.display = 'none'; return; }
  card.style.display = '';
  $('resultSheetEventName').textContent = `Event ${ev.num} · ${eventTitle(ev)} · all heats combined`;
  const rows = ev.heats.flatMap(h => h.lanes.filter(l => l.swimId).map(l => ({ ...l, heatNo: h.heatNo })))
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.heatNo - b.heatNo || a.lane - b.lane);
  $('resultSheetBody').innerHTML = rows.map(r => {
    const medal = { 1: '🥇 ', 2: '🥈 ', 3: '🥉 ' }[r.rank] || '';
    const ok = r.saved.status === 'OK' && r.saved.time;
    return `<tr>
      <td class="lr-rank">${r.rank ? medal + ordinal(r.rank) : '—'}</td>
      <td><div class="lr-name">${escHtml(r.name)}</div><div class="lr-sub">${escHtml(r.academy)}</div></td>
      <td>Heat ${r.heatNo} · L${r.lane}</td>
      <td class="lr-time">${ok ? fmtTime(r.saved.time) : '—'}</td>
      <td>${escHtml(r.saved.status)}${r.saved.dq ? `<span class="lr-dq">${escHtml(r.saved.dq)}</span>` : ''}</td>
      <td><span class="lr-pts ${r.points ? '' : 'none'}">${r.points || '—'}</span></td>
    </tr>`;
  }).join('');
}

// ─── Editing ──────────────────────────────────────────────────
function findLane(heatRowId) {
  for (const ev of EVENTS) for (const h of ev.heats) for (const l of h.lanes) if (l.heatRowId === heatRowId) return l;
  return null;
}

function setEdit(lane, v) {
  const savedTime = fmtTime(lane.saved.time);
  const sameTime = parseTime(v.time) === (lane.saved.time ?? null) || v.time === savedTime;
  if (sameTime && v.status === lane.saved.status && (v.dq || '') === (lane.saved.dq || '')) edits.delete(lane.heatRowId);
  else edits.set(lane.heatRowId, v);
}

function onGridInput(e) {
  const field = e.target.dataset.field;
  const tr = e.target.closest('tr[data-id]');
  if (!field || !tr) return;
  const lane = findLane(tr.dataset.id);
  if (!lane) return;
  const v = { ...laneValue(lane) };
  if (field === 'time') {
    v.time = e.target.value.trim();
    const ms = parseTime(v.time);
    e.target.classList.toggle('ok', ms != null && ms !== undefined);
    e.target.classList.toggle('bad', ms === undefined && v.time.length > 3);
    setEdit(lane, v);
    tr.classList.toggle('lr-row-dirty', edits.has(lane.heatRowId));
    renderHeatChips(); renderFooter();
    return;
  }
  if (field === 'status') {
    v.status = e.target.value;
    if (v.status !== 'DQ') v.dq = '';
    if (v.status === 'DNS' || v.status === 'DNF') v.time = '';
  }
  if (field === 'dq') v.dq = e.target.value;
  setEdit(lane, v);
  renderGrid(); renderHeatChips(); renderFooter();
}

// ─── Save: every unsaved lane, across all heats ───────────────
async function saveChanges() {
  if (isReadOnly() || !edits.size) return true;
  const problems = [];
  const changed = [];
  edits.forEach((v, id) => {
    const lane = findLane(id);
    if (!lane) return;
    const p = laneProblem(lane, v);
    if (p) problems.push(p); else changed.push([lane, v]);
  });
  if (problems.length) {
    showToast(`Fix ${problems.length} lane${problems.length === 1 ? '' : 's'} first: ${problems[0]}`, 'warn');
    return false;
  }

  $('saveHeatBtn').disabled = true;
  const results = await Promise.all(changed.map(([lane, v]) =>
    window.sb.from('heat_rows').update({
      finish_time_ms: (v.status === 'OK' || v.status === 'DQ') ? parseTime(v.time) : null,
      status: v.status,
      dq_code: v.status === 'DQ' ? v.dq : null,
      updated_at: new Date().toISOString(),
    }).eq('heat_row_id', lane.heatRowId).select('heat_row_id')
      .then(r => ({ lane, v, r }))));

  let saved = 0, blocked = 0, failed = 0;
  const staleEvents = new Set();
  results.forEach(({ lane, v, r }) => {
    if (r.error) { failed++; console.error('[SwimFest] save lane:', r.error.message); return; }
    if (!r.data || !r.data.length) { blocked++; return; }
    saved++;
    lane.saved = { time: (v.status === 'OK' || v.status === 'DQ') ? parseTime(v.time) : null, status: v.status, dq: v.status === 'DQ' ? v.dq : '' };
    edits.delete(lane.heatRowId);
    const ev = EVENTS.find(e => e.heats.some(h => h.lanes.includes(lane)));
    if (ev && isPublished(ev)) staleEvents.add(ev);
  });

  renderAll();
  if (failed || blocked) {
    showToast(`Saved ${saved}. ${failed + blocked} lane${failed + blocked === 1 ? '' : 's'} not saved${blocked ? ' — your account isn\'t allowed to change these results' : ''}.`, 'warn');
    return false;
  }
  showToast(staleEvents.size
    ? `Saved ${saved} lane${saved === 1 ? '' : 's'}. ${staleEvents.size} published event${staleEvents.size === 1 ? '' : 's'} changed — re-publish to update ranks.`
    : `Saved ${saved} lane${saved === 1 ? '' : 's'}.`, staleEvents.size ? 'warn' : 'success');
  return true;
}

// ─── Cross-heat ranking (Rule 9.3) + points (Rule 9.4) ────────
function rankEvent(ev) {
  const all = ev.heats.flatMap(h => h.lanes.filter(l => l.swimId).map(l => ({ lane: l, v: laneValue(l) })));
  const timed = all.filter(x => x.v.status === 'OK' && parseTime(x.v.time) != null && parseTime(x.v.time) !== undefined)
    .map(x => ({ ...x, ms: parseTime(x.v.time) }))
    .sort((a, b) => a.ms - b.ms);

  // Equal times share a rank (1, 2, 2, 4)
  timed.forEach((x, i) => { x.rank = i > 0 && x.ms === timed[i - 1].ms ? timed[i - 1].rank : i + 1; });

  const scale = ev.isRelay ? RELAY_POINTS : INDIV_POINTS;
  const perAcademy = {};
  timed.forEach(x => {
    const academy = x.lane.academy;
    x.points = 0;
    if (!academy || academy === 'Unattached') return;              // unattached swimmers score nothing
    perAcademy[academy] = (perAcademy[academy] || 0) + 1;
    if (!ev.isRelay && perAcademy[academy] > MAX_SCORERS_PER_ACADEMY) return;
    x.points = scale[x.rank] || 0;
  });

  const untimed = all.filter(x => !timed.some(t => t.lane === x.lane))
    .map(x => ({ ...x, rank: null, points: 0 }));
  return { timed, untimed };
}

function triggerPublish() {
  const ev = EVENTS[state.evIdx];
  if (!ev || isReadOnly()) return;
  const lanes = ev.heats.flatMap(h => h.lanes.filter(l => l.swimId).map(l => ({ l, h })));
  const problems = lanes.map(({ l, h }) => { const p = laneProblem(l, laneValue(l)); return p ? `Heat ${h.heatNo} ${p}` : null; }).filter(Boolean);
  const missing = lanes.filter(({ l }) => !hasResult(laneValue(l)));

  if (problems.length) {
    $('publishConfirmBody').innerHTML = `<p style="margin:0;"><strong>Fix these first:</strong></p>
      <ul style="margin:8px 0 0 18px;padding:0;">${problems.map(p => `<li>${escHtml(p)}</li>`).join('')}</ul>`;
    $('publishConfirmGo').style.display = 'none';
  } else {
    $('publishConfirmGo').style.display = '';
    $('publishConfirmBody').innerHTML = `
      <p style="margin:0;">Publish results for <strong>${escHtml(eventTitle(ev))}</strong> across all ${ev.heats.length} heat${ev.heats.length === 1 ? '' : 's'}.</p>
      ${missing.length
        ? `<p style="margin:10px 0 0;color:#b45309;"><i class="fas fa-triangle-exclamation"></i> ${missing.length} swimmer${missing.length === 1 ? ' has' : 's have'} no time or status yet and won't be ranked:</p>
           <ul style="margin:6px 0 0 18px;padding:0;font-size:0.84rem;">${missing.slice(0, 8).map(({ l, h }) => `<li>Heat ${h.heatNo} L${l.lane} ${escHtml(l.name)}</li>`).join('')}${missing.length > 8 ? `<li>…and ${missing.length - 8} more</li>` : ''}</ul>`
        : '<p style="margin:10px 0 0;color:#15803d;"><i class="fas fa-circle-check"></i> Every swimmer has a time or status.</p>'}
      <p style="margin:12px 0 0;font-size:0.84rem;color:var(--ac-muted);">This saves any unsaved times, ranks swimmers across heats, awards academy points and shows the results publicly. You can re-publish later if a time changes.</p>`;
  }
  openModal('publishConfirmModal');
}

async function executePublish() {
  const ev = EVENTS[state.evIdx];
  if (!ev) return;
  const go = $('publishConfirmGo');
  go.disabled = true;
  try {
    const { timed, untimed } = rankEvent(ev);
    const rows = [...timed, ...untimed];
    const results = await Promise.all(rows.map(x => {
      const ms = parseTime(x.v.time);
      return window.sb.from('heat_rows').update({
        finish_time_ms: (x.v.status === 'OK' || x.v.status === 'DQ') && ms !== undefined ? ms : null,
        status: x.v.status,
        dq_code: x.v.status === 'DQ' ? x.v.dq : null,
        official_rank: x.rank,
        points_awarded: x.points,
        updated_at: new Date().toISOString(),
      }).eq('heat_row_id', x.lane.heatRowId).select('heat_row_id').then(r => ({ x, r }));
    }));

    let bad = 0;
    results.forEach(({ x, r }) => {
      if (r.error || !r.data || !r.data.length) { bad++; if (r.error) console.error('[SwimFest] publish:', r.error.message); return; }
      const ms = parseTime(x.v.time);
      x.lane.saved = { time: (x.v.status === 'OK' || x.v.status === 'DQ') && ms !== undefined ? ms : null, status: x.v.status, dq: x.v.status === 'DQ' ? x.v.dq : '' };
      x.lane.rank = x.rank;
      x.lane.points = x.points;
      edits.delete(x.lane.heatRowId);
    });

    closeModal('publishConfirmModal');
    renderAll();
    if (bad) showToast(`${bad} of ${rows.length} swimmers couldn't be saved — your account may not be allowed to publish this meet.`, 'warn');
    else {
      showToast(`Published: ${eventTitle(ev)}`, 'success');
      $('resultSheetCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } finally {
    go.disabled = false;
  }
}

// ─── Academy leaderboard (from published results) ────────────
function renderLeaderboard() {
  const table = {};
  EVENTS.forEach(ev => ev.heats.forEach(h => h.lanes.forEach(l => {
    if (!l.swimId || l.rank == null) return;
    if (!l.academy || l.academy === 'Unattached') return;
    const a = table[l.academy] || (table[l.academy] = { total: 0, gold: 0, silver: 0, bronze: 0 });
    a.total += l.points || 0;
    if (l.rank === 1) a.gold++;
    if (l.rank === 2) a.silver++;
    if (l.rank === 3) a.bronze++;
  })));
  const rows = Object.entries(table).sort((a, b) => b[1].total - a[1].total || b[1].gold - a[1].gold);
  const published = EVENTS.filter(isPublished).length;
  $('lbMeta').textContent = `${published} of ${EVENTS.length} events published · ${rows.length} academies scoring · unattached swimmers don't score`;
  $('leaderboardBody').innerHTML = rows.length
    ? rows.map(([name, p], i) => `<tr><td><strong>${i + 1}</strong></td><td>${escHtml(name)}</td><td>${p.gold}</td><td>${p.silver}</td><td>${p.bronze}</td><td><strong>${p.total}</strong></td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--ac-muted);">No results published yet.</td></tr>';
  openModal('leaderboardModal');
}

// ─── Upload: result-sheet CSV from Race control ───────────────
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function setUploadMsg(cls, html) {
  const box = $('uploadStatus');
  box.style.display = '';
  box.className = `lr-msg ${cls}`;
  box.innerHTML = html;
}

function handleFileUpload(file) {
  if (!file) return;
  if (isReadOnly()) { setUploadMsg('bad', 'This meet is read-only.'); return; }
  if (!EVENTS.length) { setUploadMsg('bad', 'This meet has no heats to load times into.'); return; }
  if (!/\.csv$/i.test(file.name)) {
    setUploadMsg('bad', `<i class="fas fa-circle-xmark"></i> ${escHtml(file.name)} isn't a CSV. In Excel use <em>File → Save As → CSV</em>, then upload that.`);
    return;
  }
  $('dropZoneText').textContent = file.name;
  const reader = new FileReader();
  reader.onload = () => importCsv(reader.result, file.name);
  reader.onerror = () => setUploadMsg('bad', 'Could not read the file.');
  reader.readAsText(file);
}

function importCsv(text, fileName) {
  const rows = parseCsv(text);
  if (rows.length < 2) { setUploadMsg('bad', 'The file is empty.'); return; }
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => head.findIndex(h => names.some(n => h.startsWith(n)));
  const c = { pool: col('pool'), ev: col('event no', 'event_no', 'event #'), heat: col('heat'), lane: col('lane'),
              time: col('finish'), status: col('status'), dq: col('dq') };
  if (c.ev < 0 || c.heat < 0 || c.lane < 0 || c.time < 0) {
    setUploadMsg('bad', 'Columns not recognised. Use the result sheet downloaded from Race control — it needs <em>Event no</em>, <em>Heat</em>, <em>Lane</em> and <em>Finish time</em> columns.');
    return;
  }

  // Rows match on pool + event + heat + lane; files without a Pool column match on event + heat + lane
  const index = new Map();
  EVENTS.forEach(ev => ev.heats.forEach(h => h.lanes.forEach(l => {
    if (!l.swimId) return;
    index.set(`${ev.pool}|${ev.num}|${h.heatNo}|${l.lane}`.toLowerCase(), l);
    index.set(`*|${ev.num}|${h.heatNo}|${l.lane}`, l);
  })));

  let loaded = 0, unchanged = 0;
  const skipped = [], bad = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = k => c[k] >= 0 ? String(r[c[k]] ?? '').trim() : '';
    const key = c.pool >= 0 && get('pool')
      ? `${get('pool')}|${Number(get('ev'))}|${Number(get('heat'))}|${Number(get('lane'))}`.toLowerCase()
      : `*|${Number(get('ev'))}|${Number(get('heat'))}|${Number(get('lane'))}`;
    const lane = index.get(key);
    if (!lane) { skipped.push(`Row ${line}: no swimmer in event ${get('ev')} heat ${get('heat')} lane ${get('lane')}`); return; }

    const status = (get('status').toUpperCase().match(/^(OK|DNS|DNF|DQ)/) || ['OK'])[0];
    const time = get('time');
    const dq = status === 'DQ' ? (get('dq').toUpperCase().match(/^[A-Z]{2}/) || [''])[0] : '';
    if (!time && status === 'OK') { unchanged++; return; }                 // not swum yet
    if (time && parseTime(time) === undefined) { bad.push(`Row ${line} (${lane.name}): "${time}" isn't a time`); return; }
    if (dq && !DQ_CODES[dq]) { bad.push(`Row ${line} (${lane.name}): unknown DQ code "${dq}"`); return; }

    setEdit(lane, { time: (status === 'DNS' || status === 'DNF') ? '' : fmtTime(parseTime(time)) || '', status, dq });
    if (edits.has(lane.heatRowId)) loaded++; else unchanged++;
  });

  renderAll();
  const issues = [...bad, ...skipped];
  const cls = !loaded ? (issues.length ? 'bad' : 'warn') : issues.length ? 'warn' : 'ok';
  setUploadMsg(cls, `<i class="fas fa-${loaded ? 'circle-check' : 'circle-info'}"></i>
    <strong>${escHtml(fileName)}:</strong> ${loaded} lane${loaded === 1 ? '' : 's'} loaded${unchanged ? `, ${unchanged} blank or unchanged` : ''}${issues.length ? `, ${issues.length} skipped` : ''}.
    ${loaded ? ' Check them below (heats with a dot have new times), then press <strong>Save</strong>.' : ''}
    ${issues.length ? `<ul>${issues.slice(0, 6).map(x => `<li>${escHtml(x)}</li>`).join('')}${issues.length > 6 ? `<li>…and ${issues.length - 6} more</li>` : ''}</ul>` : ''}`);
}

// ─── Navigation ───────────────────────────────────────────────
function goToEvent(i) {
  if (i < 0 || i >= EVENTS.length) return;
  state.evIdx = i;
  const ev = EVENTS[i];
  const open = ev.heats.findIndex(h => h.lanes.some(l => l.swimId && !hasResult(laneValue(l))));
  state.heatIdx = open >= 0 ? open : 0;
  renderAll();
}

function confirmDiscard() {
  return !edits.size || confirm(`You have ${edits.size} unsaved change${edits.size === 1 ? '' : 's'}. Discard them?`);
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
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4500);
}

(function() {
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast { position:fixed; bottom:28px; right:28px; z-index:99999;
      padding:12px 20px; background:#0f172a; color:#fff;
      border-radius:10px; font-size:0.85rem; font-weight:500;
      display:flex; align-items:center; gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);
      transform:translateY(20px); opacity:0; transition:all 0.3s ease;
      max-width:440px; font-family:'Inter',sans-serif; }
    .admin-toast.show { transform:translateY(0); opacity:1; }
    .admin-toast i { color:#38bdf8; }
    .admin-toast.admin-toast-success i { color:#4ade80; }
    .admin-toast.admin-toast-warn    i { color:#fbbf24; }`;
  document.head.appendChild(s);
})();

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  SESSION = window.SwimAuth ? window.SwimAuth.getSession() : null;
  renderSidebar();
  renderAll();
  loadResultTournaments();

  let currentMeet = null;
  $('resTournamentSelect').addEventListener('focus', e => { currentMeet = e.target.value; });
  $('resTournamentSelect').addEventListener('change', e => {
    if (!confirmDiscard()) { e.target.value = currentMeet || (MEET && MEET.tournament_id) || ''; return; }
    loadResultsForTournament(e.target.value);
  });
  $('refreshBtn').addEventListener('click', () => { if (MEET && confirmDiscard()) loadResultsForTournament(MEET.tournament_id); });

  // Type / upload
  $('modeSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    state.mode = b.dataset.mode;
    $('modeSeg').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    $('uploadBlock').style.display = state.mode === 'upload' ? '' : 'none';
  });

  // Event / heat
  $('eventSelector').addEventListener('change', e => goToEvent(Number(e.target.value)));
  $('prevEventBtn').addEventListener('click', () => goToEvent(state.evIdx - 1));
  $('nextEventBtn').addEventListener('click', () => goToEvent(state.evIdx + 1));
  $('heatChips').addEventListener('click', e => {
    const b = e.target.closest('button[data-heat]');
    if (!b) return;
    state.heatIdx = Number(b.dataset.heat);
    renderHeatChips(); renderGrid(); renderFooter();
  });

  // Grid edits
  $('resultGridBody').addEventListener('input', e => { if (e.target.dataset.field === 'time') onGridInput(e); });
  $('resultGridBody').addEventListener('change', e => { if (e.target.dataset.field !== 'time') onGridInput(e); });
  // Enter in a time box jumps to the next lane
  $('resultGridBody').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.dataset.field !== 'time') return;
    e.preventDefault();
    const inputs = [...$('resultGridBody').querySelectorAll('input[data-field="time"]:not(:disabled)')];
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus(); else $('saveHeatBtn').focus();
  });

  // Save / publish
  $('saveHeatBtn').addEventListener('click', saveChanges);
  $('publishResultsBtn').addEventListener('click', triggerPublish);
  $('publishConfirmClose').addEventListener('click',  () => closeModal('publishConfirmModal'));
  $('publishConfirmCancel').addEventListener('click', () => closeModal('publishConfirmModal'));
  $('publishConfirmGo').addEventListener('click', executePublish);
  $('publishConfirmModal').addEventListener('click', e => { if (e.target === $('publishConfirmModal')) closeModal('publishConfirmModal'); });

  $('printResultBtn').addEventListener('click', () => window.print());

  $('viewLeaderboardBtn').addEventListener('click', renderLeaderboard);
  $('leaderboardClose').addEventListener('click', () => closeModal('leaderboardModal'));
  $('leaderboardModal').addEventListener('click', e => { if (e.target === $('leaderboardModal')) closeModal('leaderboardModal'); });

  // Upload
  const dropZone = $('dropZone'), fileInput = $('ctxFileInput');
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { handleFileUpload(fileInput.files[0]); fileInput.value = ''; });
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('over');
    handleFileUpload(e.dataTransfer.files[0]);
  });

  $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
  $('acScrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    setNavOpen(false);
    ['publishConfirmModal', 'leaderboardModal'].forEach(closeModal);
  });

  window.addEventListener('beforeunload', e => {
    if (!edits.size) return;
    e.preventDefault();
    e.returnValue = '';
  });
});
