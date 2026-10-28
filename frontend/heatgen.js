/* ============================================================
   SwimFest — Multi-Pool Heat Generation Engine  (Chapter 8)
   heatgen.js
   ============================================================ */

'use strict';

// ─── Spearhead Lane Order Maps (Rule 8.3) ─────────────────────
// Key = seed rank (1=fastest), Value = lane number
const SPEARHEAD_8 = { 1:4, 2:5, 3:3, 4:6, 5:2, 6:7, 7:1, 8:8 };
const SPEARHEAD_6 = { 1:3, 2:4, 3:2, 4:5, 5:1, 6:6 };

// ─── Master Roster ───────────────────────────────────────────
// Populated live from Supabase event_entries for the selected
// tournament (see loadRosterForTournament). Empty until then.
let MASTER_ROSTER = [];
let currentTournamentId = null;
let MEETS = [];            // tournaments rows for the picker
let MEET = null;           // the selected meet
let SAVED = { heats: 0, results: 0 };   // what heat_rows already holds for MEET

// (Sample roster removed — the engine loads real entries from Supabase.)
// MASTER_ROSTER stays empty until a tournament's real entries load.

// ─── App State ────────────────────────────────────────────────
let generatedHeats = [];    // All heat objects after generation
let isPublished    = false;

// ─── Supabase: load approved meets into the selector ──────────
const STATUS_PILL = {
  PUBLISHED: ['Registration open', 'ac-pill-live'], CLOSED: ['Registration closed', 'ac-pill-wait'],
  LOCKED: ['Player list locked', 'ac-pill-live'], CLOSURE_REQUESTED: ['Closure requested', 'ac-pill-wait'],
  COMPLETED: ['Completed', 'ac-pill-done'],
};

async function loadTournamentOptions() {
  const sel = document.getElementById('hgTournamentSelect');
  if (!sel) return;
  if (!window.sb) { sel.innerHTML = '<option value="">Database not connected</option>'; return; }

  const { data, error } = await window.sb
    .from('tournaments')
    .select('*')   // includes pool_lengths: meets set up with a 50 m and a 25 m pool
    .in('status', Object.keys(STATUS_PILL))
    .order('start_date', { ascending: false });

  const mine = window.SwimGov ? await window.SwimGov.assignedMeetIds() : null;   // Admins: assigned meets only
  const rows = mine && data ? data.filter(t => mine.has(t.tournament_id)) : data;
  if (error || !rows || !rows.length) {
    sel.innerHTML = `<option value="">${error ? 'Could not load meets' : mine ? 'No meets assigned to you yet' : 'No approved meets yet'}</option>`;
    sel.disabled = true;
    return;
  }
  const data2 = rows;
  MEETS = data2;
  // Current & upcoming first, finished last; ?t=<id> wins, then a meet whose player list is locked
  sel.innerHTML = SwimNav.meetOptions(data2);
  const pick = SwimNav.pickMeet(data2, t => t.status === 'LOCKED');
  sel.value = pick.tournament_id;
  sel.addEventListener('change', () => loadRosterForTournament(sel.value));
  await loadRosterForTournament(sel.value);
}

// Heats can be (re)generated only once the player list is locked and
// before any results exist, so a re-draw can never wipe race times.
function generateBlocker() {
  if (!MEET) return 'Pick a meet.';
  if (MEET.status === 'PUBLISHED' || MEET.status === 'CLOSED') {
    return `Lock the player list first. <a href="playerlist.html?t=${encodeURIComponent(MEET.tournament_id)}">Open the player list</a> and lock it when every entry is right.`;
  }
  if (MEET.status !== 'LOCKED') return 'This meet has finished racing, so its heats can\'t be changed.';
  if (SAVED.results) return `Results have already been entered for ${SAVED.results} lane${SAVED.results === 1 ? '' : 's'}, so the heats can't be drawn again.`;
  if (!MASTER_ROSTER.length) return 'This meet has no race entries yet.';
  return '';
}

function renderMeetState() {
  const chip = $('hgStatusChip');
  const [label, cls] = MEET ? (STATUS_PILL[MEET.status] || [MEET.status, 'ac-pill-draft']) : ['—', 'ac-pill-draft'];
  chip.className = `ac-pill ${cls}`;
  chip.textContent = label;
  $('statSavedHeats').textContent = MEET ? SAVED.heats : '—';

  // Results can be imported once heats are saved for this meet
  const imp = $('importResultsBtn');
  const canImport = MEET && SAVED.heats > 0;
  imp.classList.toggle('is-off', !canImport);
  imp.setAttribute('aria-disabled', canImport ? 'false' : 'true');
  imp.href = canImport ? `results.html?t=${encodeURIComponent(MEET.tournament_id)}&import=1` : 'results.html';
  imp.title = canImport ? 'Load finish times from the timing system (Excel or CSV) into Live results'
                        : 'Save heats first, then import results from the timing system';

  const blocker = generateBlocker();
  $('generateBtn').disabled = !!blocker;
  const banner = $('hgBanner');
  if (blocker) {
    banner.hidden = false;
    banner.className = 'hg2-banner ' + (SAVED.results ? 'bad' : 'warn');
    $('hgBannerText').innerHTML = blocker;
  } else if (SAVED.heats) {
    banner.hidden = false;
    banner.className = 'hg2-banner info';
    $('hgBannerText').textContent = `This meet already has ${SAVED.heats} heats saved. Generating again and saving replaces them.`;
  } else {
    banner.hidden = true;
  }
}

// ─── Supabase: pull event_entries → MASTER_ROSTER shape ───────
function msToSeedStr(ms) {
  if (!ms || ms <= 0) return 'NT';
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(2).padStart(5, '0');
  return `${String(min).padStart(2,'0')}:${sec}`;
}

async function loadRosterForTournament(tournamentId) {
  currentTournamentId = tournamentId || null;
  MEET = MEETS.find(t => t.tournament_id === tournamentId) || null;
  generatedHeats = [];
  $('heatPreviewSection').hidden = true;
  $('exportCTSBtn').disabled = true;
  SAVED = { heats: 0, results: 0 };
  if (!window.sb || !tournamentId) { MASTER_ROSTER = []; refreshRosterCounts(); renderMeetState(); return; }

  // The meet's lane count is the default for pool 1
  if (MEET && MEET.lane_count) {
    const r1 = document.querySelector(`input[name="pool1Lanes"][value="${MEET.lane_count}"]`);
    if (r1) { r1.checked = true; r1.dispatchEvent(new Event('change')); }
  }
  // A meet created with two pools (Create meet: 50 m + 25 m) starts with both pools on
  const lengths = MEET && Array.isArray(MEET.pool_lengths) ? MEET.pool_lengths : [];
  if (lengths.length === 2) {
    $('pool1Name').value = '50 m pool';
    $('pool2Name').value = '25 m pool';
    if (!$('pool2Active').checked) { $('pool2Active').checked = true; $('pool2Active').dispatchEvent(new Event('change')); }
  }

  // What is already saved: heats, and lanes that already have results
  const [heatsRes, resultsRes] = await Promise.all([
    window.sb.from('heat_rows').select('pool_label, event_no, heat_number').eq('tournament_id', tournamentId),
    window.sb.from('heat_rows').select('heat_row_id', { count: 'exact', head: true }).eq('tournament_id', tournamentId)
      .or('finish_time_ms.not.is.null,status.neq.OK'),
  ]);
  SAVED.heats = new Set((heatsRes.data || []).map(h => `${h.pool_label}|${h.event_no}|${h.heat_number}`)).size;
  SAVED.results = resultsRes.count || 0;

  const { data, error } = await window.sb
    .from('event_entries')
    .select('entry_id, event_name, category, gender, seed_time_ms, swimmer_id')
    .eq('tournament_id', tournamentId);

  if (error) { console.error('[SwimFest] load entries:', error.message); MASTER_ROSTER = []; refreshRosterCounts(); renderMeetState(); return; }

  if (!data || !data.length) {
    MASTER_ROSTER = [];
    refreshRosterCounts();
    renderMeetState();
    return;
  }

  // Swimmer names/academies come from the public swimmer_directory view
  // (the swimmers table RLS blocks reading swimmers you don't own).
  const swimmerIds = [...new Set(data.map(e => e.swimmer_id).filter(Boolean))];
  const nameMap = {};
  if (swimmerIds.length) {
    const { data: dir } = await window.sb
      .from('swimmer_directory')
      .select('swimmer_id, full_name, academy_name')
      .in('swimmer_id', swimmerIds);
    (dir || []).forEach(s => { nameMap[s.swimmer_id] = s; });
  }

  MASTER_ROSTER = data.map(e => {
    const s = nameMap[e.swimmer_id] || {};
    return {
      entryId:  e.entry_id,
      swimId:   e.swimmer_id,
      name:     s.full_name || 'Unknown Swimmer',
      gender:   e.gender,
      category: e.category,
      event:    e.event_name,
      seedTime: msToSeedStr(e.seed_time_ms),
      academy:  s.academy_name || 'Unattached',
    };
  });

  refreshRosterCounts();
  renderMeetState();
}

function refreshRosterCounts() {
  $('totalEventRows').textContent = MEET ? MASTER_ROSTER.length : '—';
  $('totalAthletes').textContent  = MEET ? new Set(MASTER_ROSTER.map(r => r.swimId)).size : '—';
  refreshUnrouted();
}

// Entries whose age group isn't assigned to any active pool get no heat
function unroutedEntries() {
  const pools = getPoolConfig();
  return MASTER_ROSTER.filter(e => !pools.some(p => p.categories.includes(e.category)));
}

function refreshUnrouted() {
  const n = MEET ? unroutedEntries().length : null;
  const el = $('statUnrouted');
  el.textContent = n == null ? '—' : n;
  el.style.color = n ? '#b91c1c' : '';
}

// ─── Supabase: save generated heats to heat_rows ──────────────
async function saveHeatsToDB() {
  if (!window.sb)              { showToast('DB not connected — cannot save.', 'warn'); return false; }
  if (!currentTournamentId)    { showToast('Select a tournament first.', 'warn'); return false; }
  if (!generatedHeats.length)  { showToast('Generate heat sheets first.', 'warn'); return false; }

  // Build heat_rows only for lanes that map to a real event_entry
  const rows = [];
  generatedHeats.forEach(ev => {
    ev.heats.forEach(heat => {
      heat.lanes.forEach((lane, i) => {
        if (lane.empty || !lane.entryId) return;
        rows.push({
          tournament_id:  currentTournamentId,
          event_entry_id: lane.entryId,
          pool_label:     ev.poolLabel,
          event_no:       ev.eventNum,
          heat_number:    heat.heatNumber,
          lane_number:    i + 1,
          status:         'OK',
        });
      });
    });
  });

  if (!rows.length) {
    showToast('There are no swimmers in these heats to save.', 'warn');
    return false;
  }

  // Never replace heats once any lane has a result
  const { count: withResults, error: chkErr } = await window.sb.from('heat_rows')
    .select('heat_row_id', { count: 'exact', head: true }).eq('tournament_id', currentTournamentId)
    .or('finish_time_ms.not.is.null,status.neq.OK');
  if (chkErr) { showToast('Could not check for existing results: ' + chkErr.message, 'warn'); return false; }
  if (withResults) {
    SAVED.results = withResults;
    renderMeetState();
    showToast('Results have been entered for this meet, so its heats can\'t be replaced.', 'warn');
    return false;
  }

  // Clear the previous draw, and make sure it really is gone before inserting
  const del = await window.sb.from('heat_rows').delete().eq('tournament_id', currentTournamentId);
  if (del.error) { showToast('Could not clear the old heats: ' + del.error.message, 'warn'); return false; }
  const { count: left } = await window.sb.from('heat_rows')
    .select('heat_row_id', { count: 'exact', head: true }).eq('tournament_id', currentTournamentId);
  if (left) { showToast('The old heats could not be removed (your account may not be allowed to). Nothing was saved.', 'warn'); return false; }

  const { error } = await window.sb.from('heat_rows').insert(rows);
  if (error) { console.error('[SwimFest] save heats:', error.message); showToast('Save failed: ' + error.message, 'warn'); return false; }

  SAVED.heats = generatedHeats.reduce((n, ev) => n + ev.heats.length, 0);
  if (window.SwimGov) SwimGov.audit('HEATS_SAVED', 'TOURNAMENT', currentTournamentId,
    `${MEET ? MEET.title : ''}: saved ${SAVED.heats} heats (${rows.length} swimmers)`);
  renderMeetState();
  showToast(`Saved ${SAVED.heats} heats (${rows.length} swimmers).`, 'success');
  return true;
}

// ─── Utilities ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openModal(id)  { const m=$(id); m.classList.add('active'); m.style.display='flex'; }
function closeModal(id) { const m=$(id); m.classList.remove('active'); m.style.display='none'; }

// ─── Seed time to seconds (NT = Infinity = slowest) ──────────
function seedToSeconds(t) {
  if (!t || t.toUpperCase() === 'NT') return Infinity;
  const parts = t.split(':');
  if (parts.length === 2) {
    const [min, sec] = parts;
    return parseFloat(min) * 60 + parseFloat(sec);
  }
  return Infinity;
}

function secondsToDisplay(s) {
  if (s === Infinity) return 'NT';
  const min  = Math.floor(s / 60);
  const sec  = (s % 60).toFixed(2).padStart(5, '0');
  return `${String(min).padStart(2,'0')}:${sec}`;
}

// ─── Buffer duration by event distance ───────────────────────
function getBufferMinutes(eventName) {
  const buf50    = parseFloat($('buf50').value)    || 2.0;
  const buf100   = parseFloat($('buf100').value)   || 3.0;
  const bufRelay = parseFloat($('bufRelay').value) || 3.5;
  const n = eventName.toLowerCase();
  if (n.includes('relay')) return bufRelay;
  if (n.includes('200m') || n.includes('100m')) return buf100;
  return buf50;
}

// ─── Read Pool Config ─────────────────────────────────────────
function getPoolConfig() {
  const pools = [];

  // Pool 1
  if ($('pool1Active').checked) {
    const cats = [...document.querySelectorAll('#pool1Categories input:checked')].map(cb => cb.value);
    const lanes = parseInt(document.querySelector('input[name="pool1Lanes"]:checked')?.value || '8');
    pools.push({ id:'P1', label: $('pool1Name').value || 'Pool 1', lanes, categories: cats });
  }

  // Pool 2
  if ($('pool2Active').checked) {
    const cats = [...document.querySelectorAll('#pool2Categories input:checked')].map(cb => cb.value);
    const lanes = parseInt(document.querySelector('input[name="pool2Lanes"]:checked')?.value || '6');
    pools.push({ id:'P2', label: $('pool2Name').value || 'Pool 2', lanes, categories: cats });
  }

  return pools;
}

// ─── Route roster entries to pools ───────────────────────────
function routeEntriesToPools(pools) {
  // Group entries: pool → event → swimmers
  const poolMap = {};

  pools.forEach(pool => {
    poolMap[pool.id] = { pool, events: {} };
  });

  MASTER_ROSTER.forEach(entry => {
    // The later pool wins when an age group is ticked in both
    const pool = [...pools].reverse().find(p => p.categories.includes(entry.category));
    if (!pool) return; // No pool for this age group — counted by unroutedEntries()

    const poolId   = pool.id;
    const eventKey = `${entry.category}|${entry.gender}|${entry.event}`;

    if (!poolMap[poolId].events[eventKey]) {
      poolMap[poolId].events[eventKey] = {
        category: entry.category,
        gender   : entry.gender,
        eventName: entry.event,
        entries  : [],
      };
    }
    poolMap[poolId].events[eventKey].entries.push({ ...entry });
  });

  return poolMap;
}

// ─── Spearhead Seeding (Rule 8.3) ────────────────────────────
// Returns array of heats. Each heat = array of lane assignments.
function spearheadSeed(entries, laneCount) {
  const map = laneCount >= 8 ? SPEARHEAD_8 : SPEARHEAD_6;

  // Sort: fastest first, NT last (slowest → earlier heats, Rule 8.3 Heat Sequencing)
  const sorted = [...entries].sort((a, b) => seedToSeconds(a.seedTime) - seedToSeconds(b.seedTime));

  // Rule 8.2: Total Heats = ceil(entries / laneCount)
  const totalHeats = Math.ceil(sorted.length / laneCount);
  const heats      = Array.from({ length: totalHeats }, () => []);

  // Distribute: last heat = fastest swimmers, first heat = slowest
  // Fill heats from last to first
  sorted.forEach((entry, i) => {
    const heatIdx = totalHeats - 1 - Math.floor(i / laneCount);
    heats[heatIdx].push(entry);
  });

  // Within each heat, assign lanes using spearhead pattern
  const heatObjects = heats.map((heatEntries, hIdx) => {
    // Sort within heat: fastest first (for lane assignment)
    const sortedHeat = [...heatEntries].sort((a, b) => seedToSeconds(a.seedTime) - seedToSeconds(b.seedTime));

    const lanes = {};
    sortedHeat.forEach((entry, rank) => {
      const laneNum = map[rank + 1] || rank + 1;
      lanes[laneNum] = { ...entry, seedRank: rank + 1 };
    });

    // Fill empty lanes
    const laneArr = [];
    for (let l = 1; l <= laneCount; l++) {
      laneArr.push(lanes[l] || { empty: true, lane: l });
    }

    return {
      heatNumber   : hIdx + 1,
      totalHeats,
      isFinal      : hIdx === totalHeats - 1,
      lanes        : laneArr,
      entryCount   : heatEntries.length,
    };
  });

  return heatObjects;
}

// Minutes after midnight → "2:05 PM" (rounded to the minute)
function clock12(totalMinutes) {
  const mins = Math.round(totalMinutes) % (24 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ─── Estimated Start Time (Rule 8.4) ─────────────────────────
// Heat N Start = Session Start + (N-1) × D_buffer (summed across all prior heats/events)
function buildSchedule(allEvents) {
  const startTimeStr  = $('sessionStart').value || '08:30';
  const [sh, sm]      = startTimeStr.split(':').map(Number);
  let currentMinutes  = sh * 60 + sm;

  allEvents.forEach(ev => {
    const bufMins = getBufferMinutes(ev.eventName);
    ev.heats.forEach(heat => {
      heat.estimatedStart = clock12(currentMinutes);
      currentMinutes += bufMins;
    });
  });
}

// ─── Main Generation Engine ───────────────────────────────────
function generateHeatSheets() {
  const pools = getPoolConfig();

  const blocker = generateBlocker();
  if (blocker) { renderMeetState(); showToast(blocker.replace(/<[^>]+>/g, ''), 'warn'); return; }
  if (pools.length === 0) {
    showToast('Turn on at least one pool before generating.', 'warn');
    return;
  }
  if (pools.some(p => !p.categories.length)) {
    showToast('Each pool you use needs at least one age group.', 'warn');
    return;
  }

  {
    const poolMap   = routeEntriesToPools(pools);
    generatedHeats  = [];
    const allEvents = [];

    // Event order: sorted by category → gender → eventName
    const ORDER_CAT = { 'U-10':0, 'U-12':1, 'U-14':2, 'U-16':3 };

    Object.values(poolMap).forEach(({ pool, events }) => {
      const eventKeys = Object.keys(events).sort((a, b) => {
        const ea = events[a], eb = events[b];
        const catDiff = (ORDER_CAT[ea.category]||0) - (ORDER_CAT[eb.category]||0);
        if (catDiff !== 0) return catDiff;
        if (ea.gender !== eb.gender) return ea.gender === 'Boy' ? -1 : 1;
        return ea.eventName.localeCompare(eb.eventName);
      });

      let globalEventNum = 1;
      eventKeys.forEach(key => {
        const ev     = events[key];
        const heats  = spearheadSeed(ev.entries, pool.lanes);
        const evObj  = {
          poolId    : pool.id,
          poolLabel : pool.label,
          poolLanes : pool.lanes,
          category  : ev.category,
          gender    : ev.gender,
          eventName : ev.eventName,
          eventNum  : globalEventNum++,
          totalEntries: ev.entries.length,
          heats,
        };
        allEvents.push(evObj);
        generatedHeats.push(evObj);
      });
    });

    buildSchedule(allEvents);

    renderSummary();
    populatePreviewFilters();
    renderHeatPreview();

    $('exportCTSBtn').disabled = false;
    const btn = $('publishBtn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save heats';
    $('hgPreviewSubtitle').textContent = 'Not saved yet. Check the lanes, then save.';

    const skipped = unroutedEntries().length;
    showToast(skipped
      ? `Drew ${generatedHeats.length} races. ${skipped} entries have no pool and were left out.`
      : `Drew ${generatedHeats.length} races across ${pools.length} pool${pools.length === 1 ? '' : 's'}.`, skipped ? 'warn' : 'success');
    $('heatPreviewSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── Summary Chips ────────────────────────────────────────────
function renderSummary() {
  const totalHeatsCount = generatedHeats.reduce((s, ev) => s + ev.heats.length, 0);
  const pools           = [...new Set(generatedHeats.map(e => e.poolLabel))];
  const events          = generatedHeats.length;
  const swimmers        = new Set(MASTER_ROSTER.map(r => r.swimId)).size;
  const algo            = 'Spearhead (fastest in the middle lanes)';
  const skipped         = unroutedEntries().length;

  $('genSummary').style.display = '';
  $('genSummary').innerHTML = `
    <div class="hg-summary-chip"><i class="fas fa-swimming-pool"></i><span class="chip-n">${pools.length}</span> Pools Active</div>
    <div class="hg-summary-chip"><i class="fas fa-list"></i><span class="chip-n">${events}</span> Events</div>
    <div class="hg-summary-chip"><i class="fas fa-fire"></i><span class="chip-n">${totalHeatsCount}</span> Total Heats</div>
    <div class="hg-summary-chip"><i class="fas fa-users"></i><span class="chip-n">${swimmers}</span> Athletes</div>
    <div class="hg-summary-chip"><i class="fas fa-project-diagram"></i> Lanes: <strong>${algo}</strong></div>
    ${skipped ? `<div class="hg-summary-chip" style="color:#b91c1c;"><i class="fas fa-triangle-exclamation"></i><span class="chip-n">${skipped}</span> entries left out (no pool for their age group)</div>` : ''}`;
}

// ─── Populate Preview Filters ─────────────────────────────────
function populatePreviewFilters() {
  const pools  = [...new Set(generatedHeats.map(e => e.poolLabel))];
  const events = [...new Set(generatedHeats.map(e => e.eventName))];
  const cats   = [...new Set(generatedHeats.map(e => e.category))];

  const poolSel  = $('previewPoolFilter');
  const evSel    = $('previewEventFilter');
  const catSel   = $('previewCatFilter');

  poolSel.innerHTML  = '<option value="">All pools</option>'  + pools.map(p=>`<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('');
  evSel.innerHTML    = '<option value="">All races</option>' + events.map(e=>`<option value="${escHtml(e)}">${escHtml(e)}</option>`).join('');
  catSel.innerHTML   = '<option value="">All age groups</option>' + cats.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
}

// ─── Render Heat Preview Cards ────────────────────────────────
function renderHeatPreview() {
  const section   = $('heatPreviewSection');
  const container = $('heatCardsContainer');
  section.hidden = false;
  container.innerHTML   = '';

  const filterPool  = $('previewPoolFilter').value;
  const filterEvent = $('previewEventFilter').value;
  const filterCat   = $('previewCatFilter').value;

  const filtered = generatedHeats.filter(ev =>
    (!filterPool  || ev.poolLabel === filterPool)  &&
    (!filterEvent || ev.eventName === filterEvent) &&
    (!filterCat   || ev.category  === filterCat)
  );

  // Session info line — matches wireframe
  const totalHeatsCount = generatedHeats.reduce((s, ev) => s + ev.heats.length, 0);
  const [sh, sm]        = ($('sessionStart').value || '08:30').split(':').map(Number);
  const sessionInfoEl   = document.createElement('div');
  sessionInfoEl.className = 'hg-session-info';
  sessionInfoEl.innerHTML = `
    <span class="hg-session-info-item"><i class="fas fa-clock"></i> Session start: <strong>${clock12(sh * 60 + sm)}</strong></span>
    <span class="hg-session-info-item"><i class="fas fa-users"></i> Total Entries: <strong>${MASTER_ROSTER.length}</strong></span>
    <span class="hg-session-info-item"><i class="fas fa-fire"></i> Total Heats: <strong>${totalHeatsCount}</strong></span>
    <span class="hg-session-info-item"><i class="fas fa-project-diagram"></i> Algorithm: <strong>Spearhead (Center-Outward)</strong></span>`;
  container.appendChild(sessionInfoEl);

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.style.cssText = 'text-align:center;padding:40px;color:var(--gray);font-size:0.9rem;';
    msg.textContent = 'No events match the selected filters.';
    container.appendChild(msg);
    return;
  }

  // Group by pool
  const byPool = {};
  filtered.forEach(ev => {
    if (!byPool[ev.poolLabel]) byPool[ev.poolLabel] = [];
    byPool[ev.poolLabel].push(ev);
  });

  Object.entries(byPool).forEach(([poolLabel, events]) => {
    const divider = document.createElement('div');
    divider.className = 'hg-pool-section-label';
    divider.innerHTML = `
      <span class="hg-pool-section-label-text"><i class="fas fa-swimming-pool"></i> ${escHtml(poolLabel)}</span>
      <div class="hg-pool-section-divider"></div>`;
    container.appendChild(divider);
    events.forEach(ev => container.appendChild(buildEventBlock(ev)));
  });
}

// ─── Build Event Block ────────────────────────────────────────
function buildEventBlock(ev) {
  const block = document.createElement('div');
  block.className = 'hg-event-block';

  const catClass = ev.gender === 'Girl' ? 'girls' : '';
  const algoStr  = ev.poolLanes >= 8 ? '8-Lane Spearhead' : '6-Lane Spearhead';

  block.innerHTML = `
    <div class="hg-event-header">
      <div class="hg-event-title">
        <span class="hg-event-num-badge">Event ${ev.eventNum}</span>
        ${escHtml(ev.gender === 'Girl' ? 'Girls' : 'Boys')} ${escHtml(ev.category)} ${escHtml(ev.eventName)}
      </div>
      <div class="hg-event-meta-chips">
        <span class="hg-event-meta-chip pool-chip"><i class="fas fa-swimming-pool"></i> ${escHtml(ev.poolLabel)}</span>
        <span class="hg-event-meta-chip"><i class="fas fa-users"></i> ${ev.totalEntries} entries</span>
        <span class="hg-event-meta-chip"><i class="fas fa-fire"></i> ${ev.heats.length} heat${ev.heats.length !== 1 ? 's' : ''}</span>
        <span class="hg-event-meta-chip algo-chip"><i class="fas fa-project-diagram"></i> ${algoStr}</span>
      </div>
    </div>
    <div class="hg-heats-body" id="event-heats-${ev.poolId}-${ev.eventNum}"></div>`;

  const heatsBody = block.querySelector(`#event-heats-${ev.poolId}-${ev.eventNum}`);
  ev.heats.forEach(heat => heatsBody.appendChild(buildHeatCard(heat, ev)));

  return block;
}

// ─── Build Heat Card ──────────────────────────────────────────
function buildHeatCard(heat, ev) {
  const card = document.createElement('div');
  card.className = 'hg-heat-card';

  const heatLabel = heat.isFinal
    ? `Heat ${heat.heatNumber} of ${heat.totalHeats} — Main Heat (Fastest)`
    : `Heat ${heat.heatNumber} of ${heat.totalHeats}`;

  const badgeClass  = heat.isFinal ? 'heat-badge-main' : 'heat-badge-slow';
  const badgeText   = heat.isFinal ? 'Main Heat' : 'Slow Heat';
  const startTime   = heat.estimatedStart || '—';

  // Lane rows
  const laneRows = heat.lanes.map(lane => {
    const laneNum = heat.lanes.indexOf(lane) + 1;
    if (lane.empty) {
      return `<tr class="empty-lane">
        <td><span class="lane-num">L-${laneNum}</span></td>
        <td>—</td><td><em>(Empty Lane)</em></td><td>—</td><td>—</td><td>—</td>
      </tr>`;
    }
    const isNT = lane.seedTime?.toUpperCase() === 'NT';
    const trClass = lane.seedRank === 1 ? 'seed-1' : lane.seedRank === 2 ? 'seed-2' : '';
    return `<tr class="${trClass}">
      <td><span class="lane-num">L-${laneNum}</span></td>
      <td><span class="seed-num ${isNT ? 'nt-seed' : ''}">${isNT ? 'NT' : lane.seedRank}</span></td>
      <td class="swimmer-cell">${escHtml(lane.name)}</td>
      <td>
        <span class="cat-pill-sm ${lane.gender === 'Girl' ? 'girls' : ''}">
          ${escHtml(lane.gender === 'Girl' ? 'Girls' : 'Boys')} ${escHtml(lane.category)}
        </span>
      </td>
      <td>${escHtml(lane.academy || '—')}</td>
      <td class="seed-time-cell ${isNT ? 'nt' : ''}">${escHtml(lane.seedTime || 'NT')}</td>
    </tr>`;
  }).join('');

  card.innerHTML = `
    <div class="hg-heat-header" data-heat="${heat.heatNumber}">
      <div class="hg-heat-title">
        ${escHtml(heatLabel)}
        <span class="hg-heat-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="hg-heat-time"><i class="fas fa-clock"></i> Est. Start: ${escHtml(startTime)}</div>
      <i class="fas fa-chevron-down hg-heat-toggle-icon"></i>
    </div>
    <div class="hg-heat-body">
      <table class="hg-lane-table">
        <thead>
          <tr>
            <th>Lane</th>
            <th>Seed</th>
            <th>Swimmer Name</th>
            <th>Category</th>
            <th>Academy</th>
            <th>Seed Time</th>
          </tr>
        </thead>
        <tbody>${laneRows}</tbody>
      </table>
    </div>`;

  // Collapsible header
  card.querySelector('.hg-heat-header').addEventListener('click', function () {
    const body = card.querySelector('.hg-heat-body');
    const icon = card.querySelector('.hg-heat-toggle-icon');
    const isCollapsed = body.style.display === 'none';
    body.style.display = isCollapsed ? '' : 'none';
    this.classList.toggle('collapsed', !isCollapsed);
    icon.style.transform = isCollapsed ? '' : 'rotate(-90deg)';
  });

  return card;
}

// ─── CTS / Meet Manager Export (Rule 8.5) ────────────────────
function exportCTS() {
  if (generatedHeats.length === 0) { showToast('Generate heat sheets first.', 'warn'); return; }

  const headers = ['Pool_ID','Pool_Name','Event_No','Category','Gender','Event_Name',
                   'Heat_No','Lane_No','Swimmer_ID','Swimmer_Name','Academy','Category_Full',
                   'Seed_Time'];
  const rows = [];

  generatedHeats.forEach(ev => {
    ev.heats.forEach(heat => {
      heat.lanes.forEach((lane, i) => {
        const laneNum = i + 1;
        if (lane.empty) {
          rows.push([ev.poolId, ev.poolLabel, ev.eventNum,
                     ev.category, ev.gender, ev.eventName,
                     heat.heatNumber, laneNum, '', '(Empty Lane)', '', '', '']);
        } else {
          rows.push([ev.poolId, ev.poolLabel, ev.eventNum,
                     ev.category, ev.gender, ev.eventName,
                     heat.heatNumber, laneNum,
                     lane.swimId, lane.name, lane.academy || '',
                     `${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category}`,
                     lane.seedTime || 'NT']);
        }
      });
    });
  });

  const csv  = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });   // BOM so Excel reads names correctly
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(MEET ? MEET.title : 'SwimFest').replace(/[^\w\-]+/g, '_')}_heats.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Heat file downloaded for the timing system.', 'success');
}

// ─── Print Heat Book (Rule 8.5) ───────────────────────────────
function printHeatBook() {
  if (generatedHeats.length === 0) { showToast('Generate heat sheets first.', 'warn'); return; }
  window.print();
}

// ─── Publish ──────────────────────────────────────────────────
function publishHeatSheets() {
  openModal('publishModal');
}

async function confirmPublish() {
  const go = $('publishModalConfirm');
  go.disabled = true;
  const saved = await saveHeatsToDB();
  go.disabled = false;
  closeModal('publishModal');
  if (!saved) return;
  isPublished = true;
  const btn = $('publishBtn');
  btn.innerHTML = '<i class="fas fa-check-circle"></i> Saved';
  btn.disabled = true;
  $('hgPreviewSubtitle').textContent = 'Saved. These heats are now on Race control, Live results and the Heat sheets page.';
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
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}

// Inject toast styles
(function () {
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast { position:fixed; bottom:28px; right:28px; z-index:99999;
      padding:12px 20px; background:var(--dark); color:var(--white);
      border-radius:var(--radius-sm); font-size:0.85rem; font-weight:500;
      display:flex; align-items:center; gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);
      transform:translateY(20px); opacity:0; transition:all 0.3s ease;
      max-width:400px; font-family:'Inter',sans-serif; }
    .admin-toast.show { transform:translateY(0); opacity:1; }
    .admin-toast i { color:var(--accent); }
    .admin-toast.admin-toast-success i { color:var(--success); }
    .admin-toast.admin-toast-warn i { color:var(--warning); }`;
  document.head.appendChild(s);
})();

// ─── Pool toggle cards ────────────────────────────────────────
// At least one pool must stay on: the last pool still on can't be switched off
const LAST_POOL_TIP = 'At least one pool must stay on. Turn on the other pool first, then you can turn this one off.';
function syncPoolToggles() {
  const toggles = [$('pool1Active'), $('pool2Active')];
  const on = toggles.filter(t => t.checked).length;
  toggles.forEach((t, i) => {
    $(`pool${i + 1}Card`).classList.toggle('disabled', !t.checked);
    const locked = t.checked && on === 1;
    t.disabled = locked;
    const label = t.closest('.hg-pool-toggle');
    label.classList.toggle('is-locked', locked);
    label.title = locked ? LAST_POOL_TIP : (t.checked ? 'Turn this pool off' : 'Turn this pool on');
  });
}

function initPoolToggles() {
  ['pool1Active', 'pool2Active'].forEach(id => $(id).addEventListener('change', () => {
    syncPoolToggles();
    refreshUnrouted();
  }));
  syncPoolToggles();
  document.querySelectorAll('#pool1Categories input, #pool2Categories input').forEach(cb => cb.addEventListener('change', refreshUnrouted));

  // Radio label active state
  document.querySelectorAll('.hg-radio-opt input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', function () {
      const group = this.closest('.hg-radio-group');
      group.querySelectorAll('.hg-radio-opt').forEach(opt => opt.classList.remove('active'));
      this.closest('.hg-radio-opt').classList.add('active');
    });
  });
}

function setNavOpen(open) {
  $('acShell').classList.toggle('nav-open', open);
  $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (session) {
    const name = session.name || session.email || 'Signed in';
    $('sideName').textContent = name;
    $('sideInitials').textContent = String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD';
    $('sideRole').textContent = session.role === 'super_admin' ? 'Super Admin' : 'Admin';
    if (session.role === 'super_admin') { $('sideUserLink').setAttribute('href', 'saprofile.html'); $('sideUserLink').title = 'Your profile'; }
  }
  if (window.SwimNav) window.SwimNav.applySuperAdmin({ nav: 'hgNav', brand: 'hgBrand', brandSub: 'hgBrandSub', userLink: 'sideUserLink', name: 'sideName', initials: 'sideInitials', role: 'sideRole' }, 'heatgen.html');
  refreshRosterCounts();
  initPoolToggles();
  loadTournamentOptions();

  $('generateBtn').addEventListener('click', generateHeatSheets);
  $('exportCTSBtn').addEventListener('click', exportCTS);
  $('publishBtn').addEventListener('click', publishHeatSheets);
  $('printBtn').addEventListener('click', printHeatBook);
  ['previewPoolFilter', 'previewEventFilter', 'previewCatFilter'].forEach(id => $(id).addEventListener('change', renderHeatPreview));
  $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
  $('acScrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { setNavOpen(false); closeModal('publishModal'); } });

  $('publishModal').addEventListener('click', e => { if (e.target === $('publishModal')) closeModal('publishModal'); });
  $('publishModalClose').addEventListener('click',   () => closeModal('publishModal'));
  $('publishModalCancel').addEventListener('click',  () => closeModal('publishModal'));
  $('publishModalConfirm').addEventListener('click', confirmPublish);
});
