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

// ── Load tournaments for the filter ───────────────────────────
async function loadTournaments() {
  if (!window.sb) return;
  const { data } = await window.sb.from('tournaments').select('*').order('start_date');
  TOURNAMENTS = data || [];

  const sel = $('hsTournamentFilter');
  sel.innerHTML = TOURNAMENTS.map(t => `<option value="${t.tournament_id}">${esc(t.title)}</option>`).join('');

  // Honor ?tournament= param if provided
  const param = new URLSearchParams(location.search).get('tournament');
  if (param) {
    const match = TOURNAMENTS.find(t => t.title === decodeURIComponent(param));
    if (match) sel.value = match.tournament_id;
  }
  currentTournamentId = sel.value || (TOURNAMENTS[0] && TOURNAMENTS[0].tournament_id);
  sel.addEventListener('change', () => { currentTournamentId = sel.value; loadHeats(); });
}

function setHeader() {
  const t = TOURNAMENTS.find(x => x.tournament_id === currentTournamentId);
  if (!t) { $('hsTournamentTitle').textContent = 'No tournament selected'; return; }
  $('hsTournamentTitle').textContent = t.title;
  $('hsTournamentMeta').innerHTML =
    `<i class="fas fa-map-marker-alt"></i> ${esc(t.venue_name)}, ${esc(t.city)} &nbsp;·&nbsp; ` +
    `<i class="fas fa-swimming-pool"></i> ${esc(t.pool_length)} · ${t.lane_count} Lanes`;
}

// ── Load heat rows for the current tournament ─────────────────
async function loadHeats() {
  setHeader();
  const content = $('hsContent');
  content.innerHTML = `<div class="hs-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading heat sheets…</div>`;

  if (!window.sb || !currentTournamentId) { renderEmpty(); return; }

  // Fetch heat rows joined with the event entry (for event name/category/swimmer)
  const { data, error } = await window.sb
    .from('heat_rows')
    .select(`
      heat_row_id, pool_label, event_no, heat_number, lane_number,
      finish_time_ms, status, official_rank,
      event_entries ( event_name, category, gender, seed_time_ms,
        swimmers ( full_name, academies ( academy_name ) ) )
    `)
    .eq('tournament_id', currentTournamentId)
    .order('event_no').order('heat_number').order('lane_number');

  if (error) { console.error('[SwimFest] heat load:', error.message); renderEmpty(); return; }

  HEAT_DATA = data || [];
  if (!HEAT_DATA.length) { renderEmpty(); return; }

  buildFilters();
  render();
}

function renderEmpty() {
  $('hsCount').textContent = '';
  $('hsContent').innerHTML = `
    <div class="hs-empty">
      <i class="fas fa-calendar-times"></i>
      <p>Heat sheets for this tournament haven't been generated or published yet.</p>
      <p style="font-size:0.82rem;margin-top:6px;">Once the Event Manager runs Heat Generation, the schedule will appear here.</p>
      <a href="index.html" class="hs-btn hs-btn-primary" style="background:var(--primary);color:#fff;"><i class="fas fa-arrow-left"></i> Back to Home</a>
    </div>`;
}

// ── Build event / category filter dropdowns ───────────────────
function buildFilters() {
  const events = [...new Set(HEAT_DATA.map(r => r.event_entries && r.event_entries.event_name).filter(Boolean))];
  const cats   = [...new Set(HEAT_DATA.map(r => r.event_entries && r.event_entries.category).filter(Boolean))];

  const evSel = $('hsEventFilter');
  evSel.innerHTML = '<option value="">All Events</option>' + events.map(e=>`<option>${esc(e)}</option>`).join('');
  const catSel = $('hsCatFilter');
  catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c=>`<option>${esc(c)}</option>`).join('');

  evSel.onchange = render;
  catSel.onchange = render;
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

  if (!rows.length) { $('hsContent').innerHTML = `<div class="hs-empty"><i class="fas fa-filter"></i><p>No entries match this filter.</p></div>`; return; }

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
      const lanes = ev.heats[hn].sort((a,b)=>a.lane_number-b.lane_number);
      const isFinal = hn === Math.max(...heatKeys);
      const laneRows = lanes.map(l => {
        const ee = l.event_entries || {};
        const sw = ee.swimmers || {};
        const academy = sw.academies ? sw.academies.academy_name : '—';
        const seed = msToTime(ee.seed_time_ms);
        const isNT = seed === 'NT';
        if (!sw.full_name) {
          return `<tr class="empty-lane"><td><span class="hs-lane">L-${l.lane_number}</span></td><td colspan="4"><em>(Empty Lane)</em></td></tr>`;
        }
        return `<tr>
          <td><span class="hs-lane">L-${l.lane_number}</span></td>
          <td><strong>${esc(sw.full_name)}</strong></td>
          <td><span class="hs-cat-pill ${ee.gender==='Girl'?'girls':''}">${esc(ee.gender==='Girl'?'Girls':'Boys')} ${esc(ee.category)}</span></td>
          <td>${esc(academy)}</td>
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
    const ee = r.event_entries || {}; const sw = ee.swimmers || {};
    return [r.event_no, ee.event_name, ee.category, ee.gender, r.pool_label,
            r.heat_number, r.lane_number, sw.full_name || '',
            sw.academies ? sw.academies.academy_name : '', msToTime(ee.seed_time_ms)];
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
