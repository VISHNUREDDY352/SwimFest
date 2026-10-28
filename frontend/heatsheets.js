/* ============================================================
   SwimFest — Heat Sheets Viewer   heatsheets.js
   Reads heat_rows + event_entries from Supabase and renders
   the lane-by-lane schedule grouped by event → heat.
   ============================================================ */
'use strict';

const $ = id => document.getElementById(id);
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let TOURNAMENTS = [];
let HEAT_DATA   = [];      // enriched heat rows (joined with event + swimmer info)
let currentTournamentId = null;

function msToTime(ms) {
  if (ms === null || ms === undefined || ms === 0) return 'NT';
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
  return `${String(min).padStart(2,'0')}:${sec}`;
}

// Meets the public may see (no drafts, nothing waiting for approval or sent back)
const PUBLIC_STATUSES = ['PUBLISHED', 'CLOSED', 'LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'];
const AGE_GROUPS = ['U-10', 'U-12', 'U-14', 'U-16'];
let PEOPLE = {};            // swimmer_id → { full_name, academy_name } from the public directory

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const currentMeet = () => TOURNAMENTS.find(t => t.tournament_id === currentTournamentId);

// ── Load tournaments for the filter ───────────────────────────
async function loadTournaments() {
  if (!window.sb) return;
  const { data } = await window.sb.from('tournaments').select('*').in('status', PUBLIC_STATUSES).order('start_date');
  TOURNAMENTS = data || [];

  const sel = $('hsTournamentFilter');
  sel.innerHTML = TOURNAMENTS.length
    ? TOURNAMENTS.map(t => `<option value="${t.tournament_id}">${esc(t.title)}</option>`).join('')
    : '<option value="">No meets yet</option>';

  // ?t=<id> or ?tournament=<title> picks the meet
  const params = new URLSearchParams(location.search);
  const byId = params.get('t') && TOURNAMENTS.find(t => t.tournament_id === params.get('t'));
  const byTitle = params.get('tournament') && TOURNAMENTS.find(t => t.title === decodeURIComponent(params.get('tournament')));
  if (byId || byTitle) sel.value = (byId || byTitle).tournament_id;
  currentTournamentId = sel.value || (TOURNAMENTS[0] && TOURNAMENTS[0].tournament_id);
  sel.addEventListener('change', () => { currentTournamentId = sel.value; loadHeats(); });
}

function setHeader() {
  const t = currentMeet();
  if (!t) { $('hsTournamentTitle').textContent = 'No tournament selected'; return; }
  $('hsTournamentTitle').textContent = t.title;
  $('hsTournamentMeta').innerHTML =
    `<i class="fas fa-map-marker-alt"></i> ${esc(t.venue_name)}, ${esc(t.city)} &nbsp;·&nbsp; ` +
    `<i class="fas fa-swimming-pool"></i> ${esc(t.pool_length)} · ${t.lane_count} Lanes`;
}

// ── Load heat rows for the current tournament ─────────────────
async function loadHeats() {
  setHeader();
  HEAT_DATA = []; PEOPLE = {};
  buildFilters();   // from the meet's own races, so the dropdowns work before heats exist
  const content = $('hsContent');
  content.innerHTML = `<div class="hs-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading heat sheets…</div>`;

  if (!window.sb || !currentTournamentId) { renderEmpty(); return; }

  const { data, error } = await window.sb
    .from('heat_rows')
    .select(`heat_row_id, pool_label, event_no, heat_number, lane_number, finish_time_ms, status, official_rank,
             event_entries ( event_name, category, gender, seed_time_ms, swimmer_id )`)
    .eq('tournament_id', currentTournamentId)
    .order('event_no').order('heat_number').order('lane_number');
  if (error) { console.error('[SwimFest] heat load:', error.message); renderEmpty(); return; }

  HEAT_DATA = data || [];
  if (!HEAT_DATA.length) { renderEmpty(); return; }

  // Names and academies come from the public directory (the swimmers table itself is private)
  const ids = [...new Set(HEAT_DATA.map(r => r.event_entries && r.event_entries.swimmer_id).filter(Boolean))];
  for (let k = 0; k < ids.length; k += 150) {
    const { data: dir } = await window.sb.from('swimmer_directory')
      .select('swimmer_id, full_name, academy_name').in('swimmer_id', ids.slice(k, k + 150));
    (dir || []).forEach(p => { PEOPLE[p.swimmer_id] = p; });
  }
  buildFilters();
  render();
}

// No heats yet: say when they'll appear instead of a blank page
function scheduleNote(t) {
  if (!t) return 'Pick a meet to see its heat sheets.';
  const today = new Date().toLocaleDateString('en-CA');
  const deadline = t.registration_deadline ? String(t.registration_deadline).slice(0, 10) : '';
  if (t.status === 'COMPLETED') return 'This meet has finished. Its heat sheets were not published here.';
  if (deadline && today <= deadline) return `Heats are drawn after entries close on ${fmtDate(deadline)}, and published here before racing starts on ${fmtDate(t.start_date)}.`;
  return `Heats scheduled to be published before racing starts on ${fmtDate(t.start_date)}.`;
}

function renderEmpty() {
  $('hsCount').textContent = '';
  $('hsContent').innerHTML = `
    <div class="hs-empty">
      <i class="fas fa-calendar-day"></i>
      <p><strong>No heat sheets yet</strong></p>
      <p style="font-size:0.88rem;margin-top:6px;">${esc(scheduleNote(currentMeet()))}</p>
      <a href="index.html" class="hs-btn hs-btn-primary" style="background:var(--primary);color:#fff;"><i class="fas fa-arrow-left"></i> Back to Home</a>
    </div>`;
}

// ── Build event / category filter dropdowns ───────────────────
// From the meet's races (tournaments.events_offered) and the age groups, plus anything
// in the heats, so they're never empty; the current choice is kept when possible.
function buildFilters() {
  const t = currentMeet();
  const fromMeet = t && Array.isArray(t.events_offered) ? t.events_offered : [];
  const fromHeats = HEAT_DATA.map(r => r.event_entries && r.event_entries.event_name).filter(Boolean);
  const events = [...new Set([...fromMeet, ...fromHeats])].sort((a, b) => (parseInt(a, 10) - parseInt(b, 10)) || a.localeCompare(b));
  const cats = [...new Set([...AGE_GROUPS, ...HEAT_DATA.map(r => r.event_entries && r.event_entries.category).filter(Boolean)])];

  const evSel = $('hsEventFilter'), catSel = $('hsCatFilter');
  const keep = (sel, list) => list.includes(sel.value) ? sel.value : '';
  const ev = keep(evSel, events), cat = keep(catSel, cats);
  evSel.innerHTML = '<option value="">All Events</option>' + events.map(e => `<option>${esc(e)}</option>`).join('');
  catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  evSel.value = ev; catSel.value = cat;
  evSel.onchange = () => HEAT_DATA.length ? render() : renderEmpty();
  catSel.onchange = evSel.onchange;
}

// ── Render heat sheets ────────────────────────────────────────
function render() {
  const evFilter  = $('hsEventFilter').value;
  const catFilter = $('hsCatFilter').value;

  const rows = HEAT_DATA.filter(r => {
    const ee = r.event_entries || {};
    return (!evFilter || ee.event_name === evFilter) && (!catFilter || ee.category === catFilter);
  });

  $('hsCount').textContent = `${rows.length} lane entries`;

  if (!rows.length) { $('hsContent').innerHTML = `<div class="hs-empty"><i class="fas fa-filter"></i><p>No heats match this filter.</p><p style="font-size:0.82rem;">Pick "All Events" or another age group.</p></div>`; return; }

  // Group: event → heat → lanes
  const events = {};
  rows.forEach(r => {
    const ee = r.event_entries || {};
    const evKey = `${r.event_no}|${ee.event_name}|${ee.category}|${ee.gender}`;
    if (!events[evKey]) events[evKey] = { event_no:r.event_no, name:ee.event_name, cat:ee.category, gender:ee.gender, pool:r.pool_label, heats:{} };
    if (!events[evKey].heats[r.heat_number]) events[evKey].heats[r.heat_number] = [];
    events[evKey].heats[r.heat_number].push(r);
  });

  const html = Object.values(events).map(ev => {
    const heatKeys = Object.keys(ev.heats).map(Number).sort((a,b)=>a-b);
    const totalHeats = heatKeys.length;
    const heatsHtml = heatKeys.map(hn => {
      const byLane = Object.fromEntries(ev.heats[hn].map(l => [l.lane_number, l]));
      const isFinal = hn === Math.max(...heatKeys);
      // Every lane of the pool, so real empty lanes show as empty
      const laneCount = Math.max((currentMeet() || {}).lane_count || 8, ...ev.heats[hn].map(l => l.lane_number));
      const laneRows = Array.from({ length: laneCount }, (_, k) => k + 1).map(n => {
        const l = byLane[n];
        if (!l) return `<tr class="empty-lane"><td><span class="hs-lane">L-${n}</span></td><td colspan="4"><em>(Empty Lane)</em></td></tr>`;
        const ee = l.event_entries || {};
        const sw = PEOPLE[ee.swimmer_id] || {};
        const seed = msToTime(ee.seed_time_ms);
        const isNT = seed === 'NT';
        return `<tr>
          <td><span class="hs-lane">L-${n}</span></td>
          <td><strong>${esc(sw.full_name || 'Swimmer')}</strong></td>
          <td><span class="hs-cat-pill ${ee.gender==='Girl'?'girls':''}">${esc(ee.gender==='Girl'?'Girls':'Boys')} ${esc(ee.category)}</span></td>
          <td>${esc(sw.academy_name || 'Unattached')}</td>
          <td><span class="hs-seed ${isNT?'nt':''}">${esc(seed)}</span></td>
        </tr>`;
      }).join('');

      return `<div class="hs-heat">
        <div class="hs-heat-head">
          <span>Heat ${hn} of ${totalHeats}
            <span class="hs-heat-badge ${isFinal?'badge-main':'badge-slow'}">${isFinal?'Main Heat':'Heat'}</span>
          </span>
        </div>
        <table class="hs-table">
          <thead><tr><th>Lane</th><th>Swimmer</th><th>Category</th><th>Academy</th><th>Seed</th></tr></thead>
          <tbody>${laneRows}</tbody>
        </table>
      </div>`;
    }).join('');

    return `<div class="hs-event">
      <div class="hs-event-head">
        <div class="hs-event-title">
          <span class="hs-event-num">Event ${ev.event_no || '—'}</span>
          ${esc(ev.gender==='Girl'?'Girls':'Boys')} ${esc(ev.cat)} ${esc(ev.name)}
        </div>
        <div class="hs-event-meta">
          ${ev.pool ? `<span class="hs-chip pool"><i class="fas fa-swimming-pool"></i> ${esc(ev.pool)}</span>` : ''}
          <span class="hs-chip"><i class="fas fa-fire"></i> ${totalHeats} heat${totalHeats!==1?'s':''}</span>
        </div>
      </div>
      ${heatsHtml}
    </div>`;
  }).join('');

  $('hsContent').innerHTML = html;
}

// ── CSV download ──────────────────────────────────────────────
function downloadCSV() {
  if (!HEAT_DATA.length) { return; }
  const headers = ['Event_No','Event','Category','Gender','Pool','Heat','Lane','Swimmer','Academy','Seed_Time'];
  const rows = HEAT_DATA.map(r => {
    const ee = r.event_entries || {}; const sw = PEOPLE[ee.swimmer_id] || {};
    return [r.event_no, ee.event_name, ee.category, ee.gender, r.pool_label,
            r.heat_number, r.lane_number, sw.full_name || '',
            sw.academy_name || '', msToTime(ee.seed_time_ms)];
  });
  const csv = [headers, ...rows].map(r => r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const t = TOURNAMENTS.find(x=>x.tournament_id===currentTournamentId);
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `HeatSheets_${(t?t.title:'tournament').replace(/\s+/g,'_')}.csv`;
  a.click();
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const mBtn = $('mobileMenuBtn'), mMenu = $('mobileMenu');
  if (mBtn && mMenu) mBtn.addEventListener('click', () => mMenu.classList.toggle('active'));
  $('hsDownloadBtn').addEventListener('click', downloadCSV);

  await loadTournaments();
  await loadHeats();
});
