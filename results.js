/* ============================================================
   SwimFest — Live Result Entry & Publishing Console (Chapter 9)
   results.js
   ============================================================ */

'use strict';

// ─── DQ Fault Codes (Rule 9.2) ────────────────────────────────
const DQ_CODES = {
  'FS': 'FS — False Start',
  'IT': 'IT — Illegal Turn',
  'IS': 'IS — Illegal Stroke',
  'IK': 'IK — Illegal Kick',
  'OT': 'OT — One-Hand Touch Fault',
  'LV': 'LV — Lane Violation',
  'ET': 'ET — Relay Early Takeoff',
};

// ─── Academy Points Scale (Rule 9.4) ──────────────────────────
const INDIV_POINTS = { 1:9, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1 };
const RELAY_POINTS = { 1:18, 2:14, 3:12, 4:10, 5:8, 6:6, 7:4, 8:2 };
const MAX_SCORERS_PER_ACADEMY = 2; // Individual cap (Rule 9.4)

// ─── Event Master — all events with seed heats ───────────────
// Derived from heatgen.js MASTER_ROSTER grouped by category/gender/event
const EVENTS = [
  {
    id:'E01', num:1, category:'U-10', gender:'Boy',  name:'25m Freestyle',
    pool:'Competition Pool A', poolLanes:8, totalHeats:1,
    heats: [{
      heatNo:1, isFinal:true, startTime:'08:30 AM',
      lanes:[
        { lane:1, swimId:'SWM-047', name:'Karthik Raja',  academy:'Aqua Stars',  seedTime:'00:21.50' },
        { lane:2, swimId:'SWM-049', name:'Pranav Kumar',  academy:'Madurai AC',   seedTime:'00:23.40' },
        { lane:3, swimId:'SWM-050', name:'Anirudh Raja',  academy:'Chennai SC',   seedTime:'00:25.60' },
        { lane:4, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:5, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:6, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:7, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:8, swimId:null,      name:null,            academy:null,           seedTime:null },
      ]
    }]
  },
  {
    id:'E02', num:2, category:'U-12', gender:'Boy',  name:'50m Freestyle',
    pool:'Competition Pool A', poolLanes:8, totalHeats:2,
    heats:[
      {
        heatNo:1, isFinal:false, startTime:'08:32 AM',
        lanes:[
          { lane:1, swimId:null,      name:null,           academy:null,           seedTime:null },
          { lane:2, swimId:null,      name:null,           academy:null,           seedTime:null },
          { lane:3, swimId:'SWM-006', name:'S. Karthik',   academy:'SRM Aquatics', seedTime:'NT' },
          { lane:4, swimId:'SWM-008', name:'V. Arun',      academy:'Chennai SC',   seedTime:'NT' },
          { lane:5, swimId:'SWM-007', name:'M. Rajesh',    academy:'Unattached',   seedTime:'NT' },
          { lane:6, swimId:null,      name:null,           academy:null,           seedTime:null },
          { lane:7, swimId:null,      name:null,           academy:null,           seedTime:null },
          { lane:8, swimId:null,      name:null,           academy:null,           seedTime:null },
        ]
      },
      {
        heatNo:2, isFinal:true, startTime:'08:34 AM',
        lanes:[
          { lane:1, swimId:null,      name:null,           academy:null,           seedTime:null },
          { lane:2, swimId:'SWM-010', name:'Dev Prasad',   academy:'Madurai AC',   seedTime:'00:40.10' },
          { lane:3, swimId:'SWM-009', name:'Kiran Kumar',  academy:'Aqua Stars',   seedTime:'00:38.70' },
          { lane:4, swimId:'SWM-003', name:'P. Vijay',     academy:'SDAT Club',    seedTime:'00:31.10' },
          { lane:5, swimId:'SWM-004', name:'R. Dinesh',    academy:'Chennai SC',   seedTime:'00:32.40' },
          { lane:6, swimId:'SWM-005', name:'A. Sanjay',    academy:'YMCA Pool',    seedTime:'00:33.00' },
          { lane:7, swimId:'SWM-002', name:'Vikram Nair',  academy:'SRM Aquatics', seedTime:'00:41.50' },
          { lane:8, swimId:'SWM-001', name:'Arun Kumar',   academy:'Chennai SC',   seedTime:'00:39.20' },
        ]
      }
    ]
  },
  {
    id:'E03', num:3, category:'U-12', gender:'Boy',  name:'100m Freestyle',
    pool:'Competition Pool A', poolLanes:8, totalHeats:1,
    heats:[{
      heatNo:1, isFinal:true, startTime:'08:40 AM',
      lanes:[
        { lane:1, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:2, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:3, swimId:'SWM-013', name:'Muthu Kumar',   academy:'Aqua Stars',   seedTime:'01:32.00' },
        { lane:4, swimId:'SWM-011', name:'Ravi Shankar',  academy:'Chennai SC',   seedTime:'01:25.10' },
        { lane:5, swimId:'SWM-012', name:'Suresh Babu',   academy:'SRM Aquatics', seedTime:'01:28.40' },
        { lane:6, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:7, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:8, swimId:null,      name:null,            academy:null,           seedTime:null },
      ]
    }]
  },
  {
    id:'E04', num:4, category:'U-12', gender:'Girl', name:'50m Freestyle',
    pool:'Competition Pool A', poolLanes:8, totalHeats:1,
    heats:[{
      heatNo:1, isFinal:true, startTime:'08:44 AM',
      lanes:[
        { lane:1, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:2, swimId:'SWM-020', name:'Sneha Ravi',    academy:'Unattached',   seedTime:'NT' },
        { lane:3, swimId:'SWM-019', name:'Preethi Kumar', academy:'SRM Aquatics', seedTime:'00:45.00' },
        { lane:4, swimId:'SWM-017', name:'Divya Mohan',   academy:'Aqua Stars',   seedTime:'00:42.10' },
        { lane:5, swimId:'SWM-018', name:'Kavya Suresh',  academy:'Chennai SC',   seedTime:'00:43.90' },
        { lane:6, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:7, swimId:null,      name:null,            academy:null,           seedTime:null },
        { lane:8, swimId:null,      name:null,            academy:null,           seedTime:null },
      ]
    }]
  },
  {
    id:'E05', num:5, category:'U-14', gender:'Boy',  name:'50m Freestyle',
    pool:'Competition Pool A', poolLanes:8, totalHeats:1,
    heats:[{
      heatNo:1, isFinal:true, startTime:'08:48 AM',
      lanes:[
        { lane:1, swimId:null,      name:null,           academy:null,           seedTime:null },
        { lane:2, swimId:null,      name:null,           academy:null,           seedTime:null },
        { lane:3, swimId:'SWM-029', name:'Vijay Anand',  academy:'Aqua Stars',   seedTime:'00:31.20' },
        { lane:4, swimId:'SWM-027', name:'Naveen Raj',   academy:'SDAT Club',    seedTime:'00:29.80' },
        { lane:5, swimId:'SWM-028', name:'Hari Prasad',  academy:'Chennai SC',   seedTime:'00:30.50' },
        { lane:6, swimId:null,      name:null,           academy:null,           seedTime:null },
        { lane:7, swimId:null,      name:null,           academy:null,           seedTime:null },
        { lane:8, swimId:null,      name:null,           academy:null,           seedTime:null },
      ]
    }]
  },
  {
    id:'E06', num:6, category:'U-16', gender:'Boy',  name:'50m Freestyle',
    pool:'Competition Pool A', poolLanes:8, totalHeats:1,
    heats:[{
      heatNo:1, isFinal:true, startTime:'08:52 AM',
      lanes:[
        { lane:1, swimId:null,      name:null,             academy:null,           seedTime:null },
        { lane:2, swimId:null,      name:null,             academy:null,           seedTime:null },
        { lane:3, swimId:'SWM-038', name:'Dinesh Kumar',   academy:'SRM Aquatics', seedTime:'00:27.10' },
        { lane:4, swimId:'SWM-037', name:'Abishek Nair',   academy:'Chennai SC',   seedTime:'00:26.40' },
        { lane:5, swimId:null,      name:null,             academy:null,           seedTime:null },
        { lane:6, swimId:null,      name:null,             academy:null,           seedTime:null },
        { lane:7, swimId:null,      name:null,             academy:null,           seedTime:null },
        { lane:8, swimId:null,      name:null,             academy:null,           seedTime:null },
      ]
    }]
  },
];

// ─── App State ────────────────────────────────────────────────
const state = {
  currentEventIdx : 1,   // index into EVENTS (default: E03 50m Freestyle Boys U-12, 0-based = 2... set to E02 for demo)
  currentHeatIdx  : 1,   // heat index (0-based, defaults to last/main heat)
  entryMode       : 1,
  // Results store: { eventId_heatNo_laneNo: { finishTime, status, dqCode } }
  results         : {},
  // Published results: { eventId: [ ranked rows ] }
  published       : {},
  // Academy points accumulator
  academyPoints   : {},
};

// ─── Utilities ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openModal(id)  { const m=$(id); m.classList.add('active'); m.style.display='flex'; }
function closeModal(id) { const m=$(id); m.classList.remove('active'); m.style.display='none'; }

function timeToMs(t) {
  if (!t || t === '' || t.toUpperCase() === 'NT') return Infinity;
  const m = t.match(/^(\d{1,2}):(\d{2})\.(\d{1,2})$/);
  if (!m) return Infinity;
  return parseInt(m[1])*60000 + parseInt(m[2])*1000 + parseInt(m[3].padEnd(2,'0'));
}

function isValidTime(t) {
  if (!t) return false;
  return /^\d{1,2}:\d{2}\.\d{1,2,}$/.test(t.trim());
}

function resultKey(eventId, heatNo, lane) {
  return `${eventId}_${heatNo}_${lane}`;
}

function getResult(eventId, heatNo, lane) {
  return state.results[resultKey(eventId, heatNo, lane)] || { finishTime:'', status:'OK', dqCode:'' };
}

function setResult(eventId, heatNo, lane, data) {
  state.results[resultKey(eventId, heatNo, lane)] = data;
}

// ─── Populate Event & Heat Selectors ─────────────────────────
function populateSelectors() {
  const evSel = $('eventSelector');
  evSel.innerHTML = EVENTS.map((ev, i) =>
    `<option value="${i}" ${i === state.currentEventIdx ? 'selected' : ''}>
       Event ${ev.num}: ${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category} ${ev.name}
     </option>`
  ).join('');

  populateHeatSelector();
}

function populateHeatSelector() {
  const ev      = EVENTS[state.currentEventIdx];
  const heatSel = $('heatSelector');
  heatSel.innerHTML = ev.heats.map((h, i) =>
    `<option value="${i}" ${i === state.currentHeatIdx ? 'selected' : ''}>
       Heat ${h.heatNo} of ${ev.totalHeats}${h.isFinal ? ' (Main)' : ''}
     </option>`
  ).join('');
}

function updateBannerLabels() {
  const ev   = EVENTS[state.currentEventIdx];
  const heat = ev.heats[state.currentHeatIdx];
  $('liveEventName').textContent =
    `Event ${ev.num} — ${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category} ${ev.name} (${ev.pool} — ${ev.poolLanes} Lanes)`;
  $('liveHeatName').textContent  = `Heat ${heat.heatNo} of ${ev.totalHeats}${heat.isFinal ? ' — Main Heat' : ''}`;
  $('heatInfoTag').textContent   = `${ev.pool} — Event ${ev.num} — Heat ${heat.heatNo} of ${ev.totalHeats}`;
  $('mode1Title').textContent    = `Mode 1 Control: Direct Heat Entry (${ev.pool} — Event ${ev.num} — Heat ${heat.heatNo} of ${ev.totalHeats})`;
}

// ─── Render Entry Grid ────────────────────────────────────────
function renderGrid() {
  const ev   = EVENTS[state.currentEventIdx];
  const heat = ev.heats[state.currentHeatIdx];
  const tbody = $('resultGridBody');
  tbody.innerHTML = '';

  let filledCount = 0;

  heat.lanes.forEach(lane => {
    const isEmpty = !lane.swimId;
    const res     = getResult(ev.id, heat.heatNo, lane.lane);
    const isDQ    = res.status === 'DQ';
    const isDNS   = res.status === 'DNS';
    const isDNF   = res.status === 'DNF';
    if (res.finishTime && isValidTime(res.finishTime)) filledCount++;
    if (isDNS || isDNF) filledCount++;

    const tr = document.createElement('tr');
    if (isDQ)  tr.classList.add('row-dq');
    if (isDNS) tr.classList.add('row-dns');
    if (isDNF) tr.classList.add('row-dnf');
    tr.dataset.lane = lane.lane;

    // DQ options
    const dqOptions = Object.entries(DQ_CODES).map(([code, label]) =>
      `<option value="${code}" ${res.dqCode === code ? 'selected' : ''}>${label}</option>`
    ).join('');

    tr.innerHTML = `
      <td><span class="rg-lane-num">L-${lane.lane}</span></td>
      <td>${isEmpty ? '<em style="color:var(--gray)">(Empty Lane)</em>' : escHtml(lane.name)}</td>
      <td>${isEmpty ? '—' : escHtml(lane.academy)}</td>
      <td>
        ${isEmpty
          ? '<span style="color:var(--gray)">—</span>'
          : `<input type="text"
               class="res-time-input${res.finishTime && isValidTime(res.finishTime) ? ' time-filled' : ''}"
               data-lane="${lane.lane}"
               placeholder="00:00.00"
               maxlength="8"
               value="${escHtml(res.finishTime)}"
               ${isDNS || isDNF ? 'disabled' : ''}>`
        }
      </td>
      <td>
        ${isEmpty
          ? '<span style="color:var(--gray)">—</span>'
          : `<select class="res-status-select status-${(res.status||'ok').toLowerCase()}" data-lane="${lane.lane}">
               <option value="OK"  ${res.status==='OK'  ?'selected':''}>✓ OK</option>
               <option value="DNS" ${res.status==='DNS' ?'selected':''}>DNS — Did Not Start</option>
               <option value="DNF" ${res.status==='DNF' ?'selected':''}>DNF — Did Not Finish</option>
               <option value="DQ"  ${res.status==='DQ'  ?'selected':''}>DQ — Disqualified</option>
             </select>`
        }
      </td>
      <td>
        ${isEmpty
          ? '<span style="color:var(--gray)">—</span>'
          : `<select class="res-dq-select" data-lane="${lane.lane}" ${!isDQ ? 'disabled' : ''}>
               <option value="">— Select Code —</option>
               ${dqOptions}
             </select>
             ${isDQ && res.dqCode
               ? `<div class="res-dq-fault-tag"><i class="fas fa-exclamation-triangle"></i> Fault: ${escHtml(res.dqCode)} (${DQ_CODES[res.dqCode]?.split('—')[1]?.trim() || ''})</div>`
               : ''}`
        }
      </td>`;

    // Bind time input
    const timeInput = tr.querySelector('.res-time-input');
    if (timeInput) {
      timeInput.addEventListener('input', () => {
        const val  = timeInput.value.trim();
        const r    = getResult(ev.id, heat.heatNo, lane.lane);
        r.finishTime = val;
        setResult(ev.id, heat.heatNo, lane.lane, r);
        timeInput.classList.toggle('time-filled', isValidTime(val));
        timeInput.classList.toggle('time-invalid', val.length > 3 && !isValidTime(val));
        updateEntriesCount();
      });
    }

    // Bind status select
    const statusSel = tr.querySelector('.res-status-select');
    if (statusSel) {
      statusSel.addEventListener('change', () => {
        const r   = getResult(ev.id, heat.heatNo, lane.lane);
        r.status  = statusSel.value;
        if (r.status !== 'DQ') r.dqCode = '';
        setResult(ev.id, heat.heatNo, lane.lane, r);
        renderGrid(); // re-render to toggle DQ state
      });
    }

    // Bind DQ select
    const dqSel = tr.querySelector('.res-dq-select');
    if (dqSel) {
      dqSel.addEventListener('change', () => {
        const r   = getResult(ev.id, heat.heatNo, lane.lane);
        r.dqCode  = dqSel.value;
        setResult(ev.id, heat.heatNo, lane.lane, r);
        renderGrid();
      });
    }

    tbody.appendChild(tr);
  });

  updateEntriesCount(filledCount, heat.lanes.filter(l => l.swimId).length);
}

function updateEntriesCount(filled, total) {
  const ev    = EVENTS[state.currentEventIdx];
  const heat  = ev.heats[state.currentHeatIdx];
  let f = 0, t = 0;
  heat.lanes.forEach(lane => {
    if (!lane.swimId) return;
    t++;
    const r = getResult(ev.id, heat.heatNo, lane.lane);
    if ((r.finishTime && isValidTime(r.finishTime)) || r.status === 'DNS' || r.status === 'DNF' || r.status === 'DQ') f++;
  });
  const el = $('entriesCount');
  el.textContent = `${f} / ${t} times entered`;
  el.classList.toggle('complete', f === t && t > 0);
}

// ─── Save Draft ───────────────────────────────────────────────
function saveDraft() {
  showToast('Heat results saved (draft). Not yet published.', 'info');
}

// ─── Validate before publish ──────────────────────────────────
function validateHeatResults(ev, heat) {
  const issues = [];
  heat.lanes.forEach(lane => {
    if (!lane.swimId) return;
    const r = getResult(ev.id, heat.heatNo, lane.lane);
    if (r.status === 'OK' && !isValidTime(r.finishTime)) {
      issues.push(`L-${lane.lane} ${lane.name}: missing or invalid finish time.`);
    }
    if (r.status === 'DQ' && !r.dqCode) {
      issues.push(`L-${lane.lane} ${lane.name}: DQ selected but no fault code chosen.`);
    }
  });
  return issues;
}

// ─── Cross-Heat Aggregation & Ranking (Rule 9.3) ─────────────
function aggregateEventResults(ev) {
  const allEntries = [];

  ev.heats.forEach(heat => {
    heat.lanes.forEach(lane => {
      if (!lane.swimId) return;
      const r = getResult(ev.id, heat.heatNo, lane.lane);
      allEntries.push({
        swimId    : lane.swimId,
        name      : lane.name,
        academy   : lane.academy,
        lane      : lane.lane,
        heatNo    : heat.heatNo,
        finishTime: r.finishTime || '',
        status    : r.status || 'OK',
        dqCode    : r.dqCode || '',
      });
    });
  });

  // Rule 9.3: Filter OK entries, sort by time ascending, then append DQ/DNS/DNF
  const okEntries = allEntries
    .filter(e => e.status === 'OK' && isValidTime(e.finishTime))
    .sort((a, b) => timeToMs(a.finishTime) - timeToMs(b.finishTime));

  const nonOk = allEntries.filter(e => e.status !== 'OK' || !isValidTime(e.finishTime));

  // Assign ranks
  let rank = 1;
  okEntries.forEach(e => { e.rank = rank++; });
  nonOk.forEach(e => { e.rank = null; });

  return [...okEntries, ...nonOk];
}

// ─── Championship Points Engine (Rule 9.4) ────────────────────
function calcPointsForEvent(rankedEntries, isRelay = false) {
  const pointScale   = isRelay ? RELAY_POINTS : INDIV_POINTS;
  const academyCount = {}; // per academy scorer count

  rankedEntries.forEach(entry => {
    if (entry.status !== 'OK' || entry.rank === null) {
      entry.points = 0;
      return;
    }
    // Unattached swimmers earn no championship points
    if (!entry.academy || entry.academy === 'Unattached' || entry.academy === 'None / Unattached') {
      entry.points = 0;
      return;
    }

    const rawPts = pointScale[entry.rank] || 0;
    if (rawPts === 0) { entry.points = 0; return; }

    // Scoring cap: max 2 swimmers per academy per event (Rule 9.4)
    academyCount[entry.academy] = (academyCount[entry.academy] || 0) + 1;
    if (academyCount[entry.academy] > MAX_SCORERS_PER_ACADEMY) {
      entry.points = 0; // pass down to next eligible swimmer from different academy
    } else {
      entry.points = rawPts;
    }
  });

  return rankedEntries;
}

function accumulateAcademyPoints(eventResults) {
  eventResults.forEach(entry => {
    if (!entry.points || entry.points === 0) return;
    if (!state.academyPoints[entry.academy]) {
      state.academyPoints[entry.academy] = { total:0, gold:0, silver:0, bronze:0 };
    }
    const ap = state.academyPoints[entry.academy];
    ap.total += entry.points;
    if (entry.rank === 1) ap.gold++;
    if (entry.rank === 2) ap.silver++;
    if (entry.rank === 3) ap.bronze++;
  });
}

// ─── Convert & Publish (Rule 9.3 + 9.4) ─────────────────────
function triggerPublish() {
  const ev = EVENTS[state.currentEventIdx];

  // Validate all heats for this event
  const allIssues = [];
  ev.heats.forEach(heat => {
    const issues = validateHeatResults(ev, heat);
    issues.forEach(i => allIssues.push(`Heat ${heat.heatNo}: ${i}`));
  });

  const eventTitle = `${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category} ${ev.name}`;

  $('publishConfirmBody').innerHTML = `
    <p>Publishing official results for <strong>${escHtml(eventTitle)}</strong>.</p>
    ${allIssues.length > 0
      ? `<p class="warn" style="margin-top:10px;"><i class="fas fa-exclamation-triangle"></i> ${allIssues.length} validation issue(s):</p>
         <ul>${allIssues.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>
         <p style="margin-top:8px;font-size:0.82rem;color:var(--gray);">You can still publish. Incomplete times will appear as blank.</p>`
      : `<p class="ok" style="margin-top:10px;"><i class="fas fa-check-circle"></i> All times validated. Ready to publish.</p>`
    }
    <p style="margin-top:12px;font-size:0.82rem;color:var(--gray);">
      Publishing will: aggregate cross-heat results, assign rankings, award championship points, and make results public.
    </p>`;

  openModal('publishConfirmModal');
}

function executePublish() {
  const ev           = EVENTS[state.currentEventIdx];
  const ranked       = aggregateEventResults(ev);
  const withPoints   = calcPointsForEvent(ranked, ev.name.toLowerCase().includes('relay'));
  accumulateAcademyPoints(withPoints);

  state.published[ev.id] = withPoints;
  closeModal('publishConfirmModal');
  renderResultSheet(ev, withPoints);
  showToast(`Official results published: ${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category} ${ev.name}`, 'success');
}

// ─── Render Official Result Sheet ─────────────────────────────
function renderResultSheet(ev, ranked) {
  $('resultSheetEventName').textContent = `${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category} ${ev.name}`;
  $('resultSheetCard').style.display = '';

  const tbody = $('resultSheetBody');
  tbody.innerHTML = '';

  ranked.forEach((entry, i) => {
    const tr = document.createElement('tr');
    const rankStr = entry.rank ? `${entry.rank}${ordinal(entry.rank)}` : '—';
    const rankClass = entry.rank === 1 ? 'rank-1st' : entry.rank === 2 ? 'rank-2nd' : entry.rank === 3 ? 'rank-3rd' : entry.rank ? 'rank-top' : '';
    const medalIcon = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
    const statusClass = `sheet-status-${(entry.status||'ok').toLowerCase()}`;
    const timeDisplay = (entry.status === 'OK' && isValidTime(entry.finishTime))
      ? `<span class="sheet-time">${escHtml(entry.finishTime)}</span>`
      : `<span style="color:var(--gray)">—</span>`;
    const ptsDisplay = entry.points > 0
      ? `<span class="sheet-pts">${entry.points}</span>`
      : `<span class="sheet-pts no-pts">—</span>`;
    const dqTag = entry.dqCode
      ? `<span class="sheet-dq-code">${escHtml(entry.dqCode)}</span>`
      : '';

    tr.innerHTML = `
      <td class="${rankClass}"><span class="rank-medal">${medalIcon} ${rankStr}</span></td>
      <td>L-${entry.lane}</td>
      <td><strong>${escHtml(entry.name)}</strong></td>
      <td>${escHtml(entry.academy)}</td>
      <td>${timeDisplay}</td>
      <td class="${statusClass}">${escHtml(entry.status)}${dqTag}</td>
      <td>${ptsDisplay}</td>`;

    tbody.appendChild(tr);
  });

  // Scroll to sheet
  $('resultSheetCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return s[(v-20)%10] || s[v] || s[0];
}

// ─── Academy Leaderboard (Rule 9.4) ──────────────────────────
function renderLeaderboard() {
  const entries = Object.entries(state.academyPoints)
    .sort((a, b) => b[1].total - a[1].total);

  const eventsPublished = Object.keys(state.published).length;

  $('lbMeta').innerHTML = `
    <span><i class="fas fa-trophy"></i> ${eventsPublished} event(s) published</span>
    <span><i class="fas fa-building"></i> ${entries.length} academies scoring</span>
    <span><i class="fas fa-info-circle"></i> Unattached swimmers excluded (Rule 9.4)</span>`;

  const tbody = $('leaderboardBody');
  tbody.innerHTML = '';

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray);">No results published yet. Publish event results to see leaderboard.</td></tr>`;
    openModal('leaderboardModal');
    return;
  }

  entries.forEach(([academy, pts], i) => {
    const rank = i + 1;
    const badgeClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="lb-rank-badge ${badgeClass}">${rank}</span></td>
      <td><span class="lb-academy-name">${escHtml(academy)}</span></td>
      <td><span class="lb-medal-cell"><i class="fas fa-medal medal-gold"></i> ${pts.gold}</span></td>
      <td><span class="lb-medal-cell"><i class="fas fa-medal medal-silver"></i> ${pts.silver}</span></td>
      <td><span class="lb-medal-cell"><i class="fas fa-medal medal-bronze"></i> ${pts.bronze}</span></td>
      <td><span class="lb-points-total">${pts.total}</span></td>`;
    tbody.appendChild(tr);
  });

  openModal('leaderboardModal');
}

// ─── Mode 2: File Upload (Rule 9.1) ──────────────────────────
function handleFileUpload(file) {
  if (!file) return;
  const status = $('uploadStatus');
  status.className = 'res-upload-status loading';
  status.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Parsing ${escHtml(file.name)}…`;
  status.style.display = '';

  setTimeout(() => {
    // Simulate parsing — in production: real CSV/XLSX parser
    const ev   = EVENTS[state.currentEventIdx];
    const heat = ev.heats[state.currentHeatIdx];

    // Auto-populate sample parsed times for occupied lanes
    heat.lanes.forEach(lane => {
      if (!lane.swimId) return;
      const seedMs = lane.seedTime && lane.seedTime !== 'NT'
        ? (parseInt(lane.seedTime.split(':')[0])*60000 + parseFloat(lane.seedTime.split(':')[1])*1000)
        : 45000 + Math.random() * 15000;
      // Simulate slight improvement
      const finishMs  = seedMs * (0.96 + Math.random() * 0.06);
      const min       = Math.floor(finishMs / 60000);
      const sec       = ((finishMs % 60000) / 1000).toFixed(2).padStart(5,'0');
      const timeStr   = `${String(min).padStart(2,'0')}:${sec}`;
      setResult(ev.id, heat.heatNo, lane.lane, { finishTime: timeStr, status: 'OK', dqCode: '' });
    });

    status.className = 'res-upload-status success';
    status.innerHTML = `<i class="fas fa-check-circle"></i> File parsed: ${escHtml(file.name)} — ${heat.lanes.filter(l=>l.swimId).length} lanes populated.`;
    $('dropZoneText').textContent = file.name;

    renderGrid();
    showToast(`Touch-pad file imported: ${file.name}`, 'success');
  }, 1400);
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

(function() {
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast { position:fixed; bottom:28px; right:28px; z-index:99999;
      padding:12px 20px; background:var(--dark); color:var(--white);
      border-radius:var(--radius-sm); font-size:0.85rem; font-weight:500;
      display:flex; align-items:center; gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);
      transform:translateY(20px); opacity:0; transition:all 0.3s ease;
      max-width:420px; font-family:'Inter',sans-serif; }
    .admin-toast.show { transform:translateY(0); opacity:1; }
    .admin-toast i { color:var(--accent); }
    .admin-toast.admin-toast-success i { color:var(--success); }
    .admin-toast.admin-toast-warn    i { color:var(--warning); }`;
  document.head.appendChild(s);
})();

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populateSelectors();
  updateBannerLabels();
  renderGrid();

  // Mode toggle
  document.querySelectorAll('input[name="entryMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.entryMode = parseInt(radio.value);
      $('mode1Block').style.display = state.entryMode === 1 ? '' : 'none';
      $('mode2Block').style.display = state.entryMode === 2 ? '' : 'none';
    });
  });

  // Event / heat selectors
  $('eventSelector').addEventListener('change', function() {
    state.currentEventIdx = parseInt(this.value);
    const ev = EVENTS[state.currentEventIdx];
    state.currentHeatIdx = ev.heats.length - 1; // default to main heat
    populateHeatSelector();
    updateBannerLabels();
    renderGrid();
    $('resultSheetCard').style.display = 'none';
  });

  $('heatSelector').addEventListener('change', function() {
    state.currentHeatIdx = parseInt(this.value);
    updateBannerLabels();
    renderGrid();
  });

  // Prev / Next event
  $('prevEventBtn').addEventListener('click', () => {
    if (state.currentEventIdx > 0) {
      state.currentEventIdx--;
      state.currentHeatIdx = EVENTS[state.currentEventIdx].heats.length - 1;
      populateSelectors();
      updateBannerLabels();
      renderGrid();
      $('resultSheetCard').style.display = 'none';
    }
  });

  $('nextEventBtn').addEventListener('click', () => {
    if (state.currentEventIdx < EVENTS.length - 1) {
      state.currentEventIdx++;
      state.currentHeatIdx = EVENTS[state.currentEventIdx].heats.length - 1;
      populateSelectors();
      updateBannerLabels();
      renderGrid();
      $('resultSheetCard').style.display = 'none';
    }
  });

  // Save draft
  $('saveDraftBtn').addEventListener('click', saveDraft);

  // Publish
  $('publishResultsBtn').addEventListener('click', triggerPublish);
  $('publishConfirmClose').addEventListener('click',  () => closeModal('publishConfirmModal'));
  $('publishConfirmCancel').addEventListener('click', () => closeModal('publishConfirmModal'));
  $('publishConfirmGo').addEventListener('click', executePublish);
  $('publishConfirmModal').addEventListener('click', e => {
    if (e.target === $('publishConfirmModal')) closeModal('publishConfirmModal');
  });

  // Print result
  $('printResultBtn').addEventListener('click', () => window.print());

  // Leaderboard
  $('viewLeaderboardBtn').addEventListener('click', renderLeaderboard);
  $('leaderboardClose').addEventListener('click', () => closeModal('leaderboardModal'));
  $('leaderboardModal').addEventListener('click', e => {
    if (e.target === $('leaderboardModal')) closeModal('leaderboardModal');
  });

  // File upload (Mode 2)
  const dropZone   = $('dropZone');
  const fileInput  = $('ctxFileInput');

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileUpload(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  });

  $('uploadFileBtn').addEventListener('click', () => {
    if (fileInput.files[0]) handleFileUpload(fileInput.files[0]);
    else fileInput.click();
  });
});
