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
// tournament (see loadRosterForTournament). Falls back to the
// SAMPLE_ROSTER below when no DB entries are available so the
// engine can still be demoed.
let MASTER_ROSTER = [];
let currentTournamentId = null;

const SAMPLE_ROSTER = [
  // ── U-12 Boys ──
  { swimId:'SWM-001', name:'Arun Kumar',      gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'00:39.20', academy:'Chennai SC' },
  { swimId:'SWM-002', name:'Vikram Nair',      gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'00:41.50', academy:'SRM Aquatics' },
  { swimId:'SWM-003', name:'P. Vijay',         gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'00:31.10', academy:'SDAT Club' },
  { swimId:'SWM-004', name:'R. Dinesh',        gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'00:32.40', academy:'Chennai SC' },
  { swimId:'SWM-005', name:'A. Sanjay',        gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'00:33.00', academy:'YMCA Pool' },
  { swimId:'SWM-006', name:'S. Karthik',       gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'NT',       academy:'SRM Aquatics' },
  { swimId:'SWM-007', name:'M. Rajesh',        gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'NT',       academy:'Unattached' },
  { swimId:'SWM-008', name:'V. Arun',          gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'NT',       academy:'Chennai SC' },
  { swimId:'SWM-009', name:'Kiran Kumar',      gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'00:38.70', academy:'Aqua Stars' },
  { swimId:'SWM-010', name:'Dev Prasad',       gender:'Boy', category:'U-12', event:'50m Freestyle',    seedTime:'00:40.10', academy:'Madurai AC' },
  { swimId:'SWM-011', name:'Ravi Shankar',     gender:'Boy', category:'U-12', event:'100m Freestyle',   seedTime:'01:25.10', academy:'Chennai SC' },
  { swimId:'SWM-012', name:'Suresh Babu',      gender:'Boy', category:'U-12', event:'100m Freestyle',   seedTime:'01:28.40', academy:'SRM Aquatics' },
  { swimId:'SWM-013', name:'Muthu Kumar',      gender:'Boy', category:'U-12', event:'100m Freestyle',   seedTime:'01:32.00', academy:'Aqua Stars' },
  { swimId:'SWM-014', name:'Ajay Prakash',     gender:'Boy', category:'U-12', event:'50m Backstroke',   seedTime:'00:44.20', academy:'Chennai SC' },
  { swimId:'SWM-015', name:'Balaji R.',        gender:'Boy', category:'U-12', event:'50m Backstroke',   seedTime:'00:46.80', academy:'SDAT Club' },
  { swimId:'SWM-016', name:'Gopal Krishna',    gender:'Boy', category:'U-12', event:'50m Backstroke',   seedTime:'NT',       academy:'Unattached' },

  // ── U-12 Girls ──
  { swimId:'SWM-017', name:'Divya Mohan',      gender:'Girl', category:'U-12', event:'50m Freestyle',   seedTime:'00:42.10', academy:'Aqua Stars' },
  { swimId:'SWM-018', name:'Kavya Suresh',     gender:'Girl', category:'U-12', event:'50m Freestyle',   seedTime:'00:43.90', academy:'Chennai SC' },
  { swimId:'SWM-019', name:'Preethi Kumar',    gender:'Girl', category:'U-12', event:'50m Freestyle',   seedTime:'00:45.00', academy:'SRM Aquatics' },
  { swimId:'SWM-020', name:'Sneha Ravi',       gender:'Girl', category:'U-12', event:'50m Freestyle',   seedTime:'NT',       academy:'Unattached' },
  { swimId:'SWM-021', name:'Revathy S.',       gender:'Girl', category:'U-12', event:'50m Breaststroke',seedTime:'00:51.30', academy:'Aqua Stars' },
  { swimId:'SWM-022', name:'Nithya Lakshmi',   gender:'Girl', category:'U-12', event:'50m Breaststroke',seedTime:'00:53.80', academy:'SDAT Club' },

  // ── U-14 Boys ──
  { swimId:'SWM-023', name:'Raj Pandian',      gender:'Boy', category:'U-14', event:'100m Backstroke',  seedTime:'01:18.60', academy:'Madurai AC' },
  { swimId:'SWM-024', name:'Rahul Menon',      gender:'Boy', category:'U-14', event:'50m Butterfly',    seedTime:'00:34.20', academy:'Chennai SC' },
  { swimId:'SWM-025', name:'Arjun Selvam',     gender:'Boy', category:'U-14', event:'50m Butterfly',    seedTime:'00:35.90', academy:'Aqua Stars' },
  { swimId:'SWM-026', name:'Siva Kumar',       gender:'Boy', category:'U-14', event:'50m Butterfly',    seedTime:'00:37.50', academy:'SRM Aquatics' },
  { swimId:'SWM-027', name:'Naveen Raj',       gender:'Boy', category:'U-14', event:'50m Freestyle',    seedTime:'00:29.80', academy:'SDAT Club' },
  { swimId:'SWM-028', name:'Hari Prasad',      gender:'Boy', category:'U-14', event:'50m Freestyle',    seedTime:'00:30.50', academy:'Chennai SC' },
  { swimId:'SWM-029', name:'Vijay Anand',      gender:'Boy', category:'U-14', event:'50m Freestyle',    seedTime:'00:31.20', academy:'Aqua Stars' },
  { swimId:'SWM-030', name:'Karthik Raj',      gender:'Boy', category:'U-14', event:'200m Freestyle',   seedTime:'02:24.50', academy:'Madurai AC' },

  // ── U-14 Girls ──
  { swimId:'SWM-031', name:'Priya Suresh',     gender:'Girl', category:'U-14', event:'50m Backstroke',  seedTime:'00:44.20', academy:'Chennai SC' },
  { swimId:'SWM-032', name:'Lakshmi Rao',      gender:'Girl', category:'U-14', event:'100m Freestyle',  seedTime:'01:12.30', academy:'SDAT Club' },
  { swimId:'SWM-033', name:'Deepa Anand',      gender:'Girl', category:'U-14', event:'100m Freestyle',  seedTime:'01:15.00', academy:'SRM Aquatics' },
  { swimId:'SWM-034', name:'Shalini Kumar',    gender:'Girl', category:'U-14', event:'50m Butterfly',   seedTime:'00:38.40', academy:'Chennai SC' },
  { swimId:'SWM-035', name:'Pooja Krishnan',   gender:'Girl', category:'U-14', event:'50m Butterfly',   seedTime:'NT',       academy:'Unattached' },

  // ── U-16 Boys ──
  { swimId:'SWM-036', name:'Surya Prakash',    gender:'Boy', category:'U-16', event:'50m Butterfly',    seedTime:'00:31.80', academy:'SDAT Club' },
  { swimId:'SWM-037', name:'Abishek Nair',     gender:'Boy', category:'U-16', event:'50m Freestyle',    seedTime:'00:26.40', academy:'Chennai SC' },
  { swimId:'SWM-038', name:'Dinesh Kumar',     gender:'Boy', category:'U-16', event:'50m Freestyle',    seedTime:'00:27.10', academy:'SRM Aquatics' },
  { swimId:'SWM-039', name:'Suresh Rajan',     gender:'Boy', category:'U-16', event:'100m Freestyle',   seedTime:'00:57.90', academy:'SDAT Club' },
  { swimId:'SWM-040', name:'Muthu Raj',        gender:'Boy', category:'U-16', event:'200m Freestyle',   seedTime:'02:14.50', academy:'Chennai SC' },
  { swimId:'SWM-041', name:'Vijay Kumar',      gender:'Boy', category:'U-16', event:'100m Breaststroke',seedTime:'01:22.30', academy:'Madurai AC' },

  // ── U-16 Girls ──
  { swimId:'SWM-042', name:'Meera Shankar',    gender:'Girl', category:'U-16', event:'100m Freestyle',  seedTime:'01:08.40', academy:'SDAT Club' },
  { swimId:'SWM-043', name:'Ananya Pillai',    gender:'Girl', category:'U-16', event:'100m Freestyle',  seedTime:'01:11.20', academy:'SRM Aquatics' },
  { swimId:'SWM-044', name:'Lakshmi Priya',    gender:'Girl', category:'U-16', event:'200m Freestyle',  seedTime:'02:28.60', academy:'Chennai SC' },
  { swimId:'SWM-045', name:'Parvathy R.',      gender:'Girl', category:'U-16', event:'50m Butterfly',   seedTime:'00:35.10', academy:'SDAT Club' },
  { swimId:'SWM-046', name:'Rohini Kumar',     gender:'Girl', category:'U-16', event:'200m Freestyle',  seedTime:'NT',       academy:'Unattached' },

  // ── U-10 Boys ──
  { swimId:'SWM-047', name:'Karthik Raja',     gender:'Boy', category:'U-10', event:'25m Freestyle',    seedTime:'00:21.50', academy:'Aqua Stars' },
  { swimId:'SWM-048', name:'Arjun Selvam',     gender:'Boy', category:'U-10', event:'25m Breaststroke', seedTime:'00:28.90', academy:'Aqua Stars' },
  { swimId:'SWM-049', name:'Pranav Kumar',     gender:'Boy', category:'U-10', event:'25m Freestyle',    seedTime:'00:23.40', academy:'Madurai AC' },
  { swimId:'SWM-050', name:'Anirudh Raja',     gender:'Boy', category:'U-10', event:'25m Backstroke',   seedTime:'00:25.60', academy:'Chennai SC' },
];

// Start with the sample so the page renders before DB load.
MASTER_ROSTER = SAMPLE_ROSTER;

// ─── App State ────────────────────────────────────────────────
let generatedHeats = [];    // All heat objects after generation
let isPublished    = false;

// ─── Supabase: load tournaments into the selector ─────────────
async function loadTournamentOptions() {
  const sel = document.getElementById('hgTournamentSelect');
  if (!sel) return;
  if (!window.sb) { sel.innerHTML = '<option value="">DB not connected</option>'; return; }

  const { data, error } = await window.sb
    .from('tournaments')
    .select('tournament_id, title, status')
    .order('start_date', { ascending: false });

  if (error || !data || !data.length) {
    sel.innerHTML = '<option value="">No tournaments found</option>';
    return;
  }

  sel.innerHTML = data.map(t =>
    `<option value="${t.tournament_id}">${escHtml(t.title)} — ${t.status}</option>`
  ).join('');

  sel.addEventListener('change', () => loadRosterForTournament(sel.value));
  await loadRosterForTournament(sel.value);
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
  if (!window.sb || !tournamentId) { MASTER_ROSTER = SAMPLE_ROSTER; refreshRosterCounts(); return; }

  const { data, error } = await window.sb
    .from('event_entries')
    .select('entry_id, event_name, category, gender, seed_time_ms, swimmer_id')
    .eq('tournament_id', tournamentId);

  if (error) { console.error('[SwimFest] load entries:', error.message); MASTER_ROSTER = SAMPLE_ROSTER; refreshRosterCounts(); return; }

  if (!data || !data.length) {
    // No real entries yet — nothing to seed for this tournament.
    MASTER_ROSTER = [];
    refreshRosterCounts();
    showToast('No confirmed entries for this tournament yet.', 'warn');
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
  showToast(`Loaded ${MASTER_ROSTER.length} entries for this tournament.`, 'success');
}

function refreshRosterCounts() {
  const rows = document.getElementById('totalEventRows');
  const ath  = document.getElementById('totalAthletes');
  if (rows) rows.textContent = MASTER_ROSTER.length;
  if (ath)  ath.textContent  = new Set(MASTER_ROSTER.map(r => r.swimId)).size;
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
    showToast('No real entries to save (using sample data). Load a tournament with entries.', 'warn');
    return false;
  }

  // Clear any previous heat rows for this tournament, then insert fresh
  const del = await window.sb.from('heat_rows').delete().eq('tournament_id', currentTournamentId);
  if (del.error) { console.error('[SwimFest] clear heats:', del.error.message); }

  const { error } = await window.sb.from('heat_rows').insert(rows);
  if (error) { console.error('[SwimFest] save heats:', error.message); showToast('Save failed: ' + error.message, 'warn'); return false; }

  // Mark the tournament as LOCKED (heats generated)
  await window.sb.from('tournaments').update({ status: 'LOCKED' }).eq('tournament_id', currentTournamentId);

  showToast(`Saved ${rows.length} heat lane rows to the database.`, 'success');
  return true;
}

// ─── Utilities ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s)
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
    // Find pool that handles this category
    const pool = pools.find(p => p.categories.includes(entry.category));
    if (!pool) return; // No pool configured for this category

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

// ─── Estimated Start Time (Rule 8.4) ─────────────────────────
// Heat N Start = Session Start + (N-1) × D_buffer (summed across all prior heats/events)
function buildSchedule(allEvents) {
  const startTimeStr  = $('sessionStart').value || '08:30';
  const [sh, sm]      = startTimeStr.split(':').map(Number);
  let currentMinutes  = sh * 60 + sm;

  allEvents.forEach(ev => {
    const bufMins = getBufferMinutes(ev.eventName);
    ev.heats.forEach(heat => {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      heat.estimatedStart = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} AM`;
      currentMinutes += bufMins;
    });
  });
}

// ─── Main Generation Engine ───────────────────────────────────
function generateHeatSheets() {
  const pools = getPoolConfig();

  if (pools.length === 0) {
    showToast('Configure at least one active pool before generating.', 'warn');
    return;
  }

  const btn = $('generateBtn');
  btn.classList.add('generating');
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating…';

  setTimeout(() => {
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

    btn.classList.remove('generating');
    btn.innerHTML = '<i class="fas fa-bolt"></i> Generate Heat Sheets';

    renderSummary();
    renderHeatPreview();
    populatePreviewFilters();

    // Enable action buttons
    $('exportCTSBtn').disabled = false;
    $('heatsGeneratedBadge').style.display = '';
    $('totalEventRows').textContent = MASTER_ROSTER.length;

    showToast(`Heat sheets generated — ${generatedHeats.length} events across ${pools.length} pool(s).`, 'success');
  }, 900);
}

// ─── Summary Chips ────────────────────────────────────────────
function renderSummary() {
  const totalHeatsCount = generatedHeats.reduce((s, ev) => s + ev.heats.length, 0);
  const pools           = [...new Set(generatedHeats.map(e => e.poolLabel))];
  const events          = generatedHeats.length;
  const swimmers        = new Set(MASTER_ROSTER.map(r => r.swimId)).size;
  const algo            = generatedHeats.some(e => e.poolLanes >= 8) ? '8-Lane Spearhead' : '6-Lane Spearhead';

  $('genSummary').style.display = '';
  $('genSummary').innerHTML = `
    <div class="hg-summary-chip"><i class="fas fa-swimming-pool"></i><span class="chip-n">${pools.length}</span> Pools Active</div>
    <div class="hg-summary-chip"><i class="fas fa-list"></i><span class="chip-n">${events}</span> Events</div>
    <div class="hg-summary-chip"><i class="fas fa-fire"></i><span class="chip-n">${totalHeatsCount}</span> Total Heats</div>
    <div class="hg-summary-chip"><i class="fas fa-users"></i><span class="chip-n">${swimmers}</span> Athletes</div>
    <div class="hg-summary-chip"><i class="fas fa-project-diagram"></i> Algorithm: <strong>${algo}</strong></div>`;
}

// ─── Populate Preview Filters ─────────────────────────────────
function populatePreviewFilters() {
  const pools  = [...new Set(generatedHeats.map(e => e.poolLabel))];
  const events = [...new Set(generatedHeats.map(e => e.eventName))];
  const cats   = [...new Set(generatedHeats.map(e => e.category))];

  const poolSel  = $('previewPoolFilter');
  const evSel    = $('previewEventFilter');
  const catSel   = $('previewCatFilter');

  poolSel.innerHTML  = '<option value="">All Pools</option>'  + pools.map(p=>`<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('');
  evSel.innerHTML    = '<option value="">All Events</option>' + events.map(e=>`<option value="${escHtml(e)}">${escHtml(e)}</option>`).join('');
  catSel.innerHTML   = '<option value="">All Categories</option>' + cats.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

  [poolSel, evSel, catSel].forEach(s => s.addEventListener('change', renderHeatPreview));
}

// ─── Render Heat Preview Cards ────────────────────────────────
function renderHeatPreview() {
  const section   = $('heatPreviewSection');
  const container = $('heatCardsContainer');
  section.style.display = '';
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
  const startTime       = $('sessionStart').value || '08:30';
  const sessionInfoEl   = document.createElement('div');
  sessionInfoEl.className = 'hg-session-info';
  sessionInfoEl.innerHTML = `
    <span class="hg-session-info-item"><i class="fas fa-clock"></i> Session Start: <strong>${startTime} AM</strong></span>
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
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `SwimFest_HeatSheets_CTS_2026.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CTS/Meet Manager file exported.', 'success');
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
  const saved = await saveHeatsToDB();
  if (!saved) { closeModal('publishModal'); return; }
  isPublished = true;
  closeModal('publishModal');
  const btn = $('publishBtn');
  if (btn) {
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Published';
    btn.style.background = '#219a52';
    btn.disabled = true;
  }
  showToast('Heat sheets published to the database — now visible on Heat Sheets & Results.', 'success');
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
function initPoolToggles() {
  $('pool1Active').addEventListener('change', function () {
    $('pool1Card').classList.toggle('disabled', !this.checked);
  });
  $('pool2Active').addEventListener('change', function () {
    $('pool2Card').classList.toggle('disabled', !this.checked);
  });

  // Radio label active state
  document.querySelectorAll('.hg-radio-opt input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', function () {
      const group = this.closest('.hg-radio-group');
      group.querySelectorAll('.hg-radio-opt').forEach(opt => opt.classList.remove('active'));
      this.closest('.hg-radio-opt').classList.add('active');
    });
  });
}

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshRosterCounts();
  initPoolToggles();
  loadTournamentOptions();

  $('generateBtn').addEventListener('click', generateHeatSheets);
  $('exportCTSBtn').addEventListener('click', exportCTS);

  // publishBtn and printBtn live inside heatPreviewSection — wire after generate via event delegation
  document.addEventListener('click', function(e) {
    if (e.target.closest('#publishBtn')) publishHeatSheets();
    if (e.target.closest('#printBtn'))   printHeatBook();
  });

  $('publishModal').addEventListener('click', e => { if (e.target === $('publishModal')) closeModal('publishModal'); });
  $('publishModalClose').addEventListener('click',   () => closeModal('publishModal'));
  $('publishModalCancel').addEventListener('click',  () => closeModal('publishModal'));
  $('publishModalConfirm').addEventListener('click', confirmPublish);
});
