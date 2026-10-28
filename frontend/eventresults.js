/* ============================================================
   SwimFest – public results on the meet page (Results tab)
   One collapsible block per race, e.g. "Event 3 · Boys U-12
   50m Freestyle", with every finisher ranked across all heats:
   Rank · Heat/Lane · Swimmer · Academy · Seed · Finish · Behind
   winner · Status (DQ shows its fault code) · Points.
   Called from event.js with the loaded meet: SwimResults.load(t).
   ============================================================ */
(function () {
  'use strict';

  const DQ_CODES = {
    FS: 'False start', IT: 'Illegal turn', IS: 'Illegal stroke', IK: 'Illegal kick',
    OT: 'One-hand touch', LV: 'Lane violation', ET: 'Relay early take-off',
  };
  const STATUS_TEXT = { DNS: 'DNS (did not start)', DNF: 'DNF (did not finish)' };
  const REFRESH_MS = 30000;   // while racing, pick up new times every 30 s

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

  // 31420 → "00:31.42", 65230 → "01:05.23"
  function fmtTime(ms) {
    if (ms == null) return '—';
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), h = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(h).padStart(2, '0')}`;
  }
  const fmtDiff = ms => ms == null ? '' : ms === 0 ? '—' : `+${(ms / 1000).toFixed(2)}s`;

  function genderLabel(g) {
    const v = String(g || '').toLowerCase();
    return v.startsWith('g') || v.startsWith('f') ? 'Girls' : v.startsWith('b') || v.startsWith('m') ? 'Boys' : 'Mixed';
  }

  // A heat row has a result once it has a time or a non-OK status
  const hasResult = r => r.finish_time_ms != null || (r.status && r.status !== 'OK');

  async function fetchRows(tid) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await window.sb.from('heat_rows')
        .select(`heat_row_id, pool_label, event_no, heat_number, lane_number, finish_time_ms, status, dq_code,
                 official_rank, points_awarded, event_entries ( event_name, category, gender, seed_time_ms, swimmer_id, is_relay )`)
        .eq('tournament_id', tid)
        .order('event_no').order('heat_number').order('lane_number')
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) return rows;
    }
  }

  async function fetchPeople(rows) {
    const ids = [...new Set(rows.map(r => r.event_entries && r.event_entries.swimmer_id).filter(Boolean))];
    const people = {};
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await window.sb.from('swimmer_directory')
        .select('swimmer_id, full_name, academy_name').in('swimmer_id', ids.slice(i, i + 150));
      (data || []).forEach(p => { people[p.swimmer_id] = p; });
    }
    return people;
  }

  // Group heat rows into races and rank each race across its heats
  function buildEvents(rows, people) {
    const map = new Map();
    rows.forEach(r => {
      const ee = r.event_entries || {};
      const key = `${r.pool_label || ''}|${r.event_no}|${ee.gender}|${ee.category}|${ee.event_name}`;
      if (!map.has(key)) {
        map.set(key, {
          no: r.event_no, pool: r.pool_label,
          title: `${genderLabel(ee.gender)} ${ee.category || ''} ${ee.event_name || ''}`.replace(/\s+/g, ' ').trim(),
          relay: !!ee.is_relay, rows: [], total: 0,
        });
      }
      const ev = map.get(key);
      ev.total++;
      if (!hasResult(r)) return;
      const p = people[ee.swimmer_id] || {};
      ev.rows.push({
        heat: r.heat_number, lane: r.lane_number, name: p.full_name || 'Swimmer', academy: p.academy_name || 'Unattached',
        seed: ee.seed_time_ms, time: r.finish_time_ms, status: r.status || 'OK', dq: r.dq_code,
        rank: r.official_rank, official: r.official_rank != null, points: r.points_awarded || 0,
      });
    });

    const events = [...map.values()].sort((a, b) => (a.no || 0) - (b.no || 0));
    events.forEach(ev => {
      const ok = ev.rows.filter(x => x.status === 'OK' && x.time != null).sort((a, b) => a.time - b.time);
      const rest = ev.rows.filter(x => !(x.status === 'OK' && x.time != null))
        .sort((a, b) => ['DQ', 'DNF', 'DNS'].indexOf(a.status) - ['DQ', 'DNF', 'DNS'].indexOf(b.status));
      // Equal times share a rank; official_rank (set by the referee) wins when present
      let prevTime = null, prevRank = 0;
      ok.forEach((x, i) => {
        const computed = x.time === prevTime ? prevRank : i + 1;
        prevTime = x.time; prevRank = computed;
        x.rank = x.rank || computed;
        x.diff = x.time - ok[0].time;
      });
      ev.rows = [...ok, ...rest];
      ev.done = ev.rows.length === ev.total;
      // Published = officials pressed "Publish event results" (every timed swimmer has an official place)
      ev.published = ev.done && ok.every(x => x.official);
    });
    return events.filter(ev => ev.rows.length);
  }

  function statusCell(x) {
    if (x.status === 'DQ') {
      const code = x.dq && DQ_CODES[x.dq] ? `${x.dq}: ${DQ_CODES[x.dq]}` : 'fault not recorded';
      return `<span class="evr-status evr-bad">DQ (${esc(code)})</span>`;
    }
    if (STATUS_TEXT[x.status]) return `<span class="evr-status evr-muted">${STATUS_TEXT[x.status]}</span>`;
    return `<span class="evr-status evr-ok">OK</span>`;
  }

  function eventHtml(ev, open) {
    const medal = r => r === 1 ? 'evr-gold' : r === 2 ? 'evr-silver' : r === 3 ? 'evr-bronze' : '';
    const rows = ev.rows.map(x => {
      const ranked = x.status === 'OK' && x.time != null;
      return `<tr>
        <td>${ranked ? `<span class="evr-rank ${medal(x.rank)}">${ordinal(x.rank)}</span>` : '—'}</td>
        <td class="evr-num">H${x.heat} · L${x.lane}</td>
        <td><strong>${esc(x.name)}</strong></td>
        <td>${esc(x.academy)}</td>
        <td class="evr-num">${x.seed ? fmtTime(x.seed) : 'NT'}</td>
        <td class="evr-num evr-time">${x.status === 'OK' || x.status === 'DQ' ? fmtTime(x.time) : '—'}</td>
        <td class="evr-num">${ranked ? fmtDiff(x.diff) : ''}</td>
        <td>${statusCell(x)}</td>
        <td class="evr-num">${x.points || '—'}</td>
      </tr>`;
    }).join('');
    const state = ev.done ? 'Final' : `${ev.rows.length} of ${ev.total} swum`;
    return `<details class="evr-event"${open ? ' open' : ''}>
      <summary>
        <span class="evr-evno">Event ${ev.no ?? '—'}</span>
        <span class="evr-title">${esc(ev.title)}${ev.relay ? ' (relay)' : ''}</span>
        <span class="evr-state ${ev.done ? 'is-final' : ''}">${state}</span>
      </summary>
      <div class="evr-wrap"><table class="evr-table">
        <thead><tr><th>Rank</th><th>Heat · Lane</th><th>Swimmer</th><th>Academy</th><th>Seed</th>
          <th>Finish</th><th>Behind 1st</th><th>Status</th><th>Points</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </details>`;
  }

  const css = `
  .evr-head{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;justify-content:space-between;margin:4px 0 14px;font-size:.85rem;color:#64748b}
  .evr-live{display:inline-flex;align-items:center;gap:6px;color:#15803d;font-weight:600}
  .evr-live::before{content:"";width:8px;height:8px;border-radius:50%;background:#22c55e}
  .evr-event{border:1px solid #e2e8f0;border-radius:12px;margin-bottom:10px;background:#fff;overflow:hidden}
  .evr-event summary{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;list-style:none;flex-wrap:wrap}
  .evr-event summary::-webkit-details-marker{display:none}
  .evr-event summary::after{content:"▾";margin-left:auto;color:#94a3b8;transition:transform .15s}
  .evr-event[open] summary::after{transform:rotate(180deg)}
  .evr-evno{font-size:.75rem;font-weight:700;color:#0077b6;background:#e0f2fe;border-radius:999px;padding:3px 10px}
  .evr-title{font-weight:700;color:#0f172a}
  .evr-state{font-size:.75rem;color:#92400e;background:#fef3c7;border-radius:999px;padding:3px 10px}
  .evr-state.is-final{color:#166534;background:#dcfce7}
  .evr-wrap{overflow-x:auto;border-top:1px solid #e2e8f0}
  .evr-table{width:100%;border-collapse:collapse;font-size:.85rem;min-width:760px}
  .evr-table th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;color:#64748b;background:#f8fafc;padding:8px 12px;white-space:nowrap}
  .evr-table td{padding:9px 12px;border-top:1px solid #f1f5f9;vertical-align:middle}
  .evr-num{font-variant-numeric:tabular-nums;white-space:nowrap}
  .evr-time{font-weight:700}
  .evr-rank{display:inline-block;min-width:2.6em;text-align:center;font-weight:700;border-radius:999px;padding:2px 8px;background:#f1f5f9}
  .evr-gold{background:#fde68a;color:#78350f}.evr-silver{background:#e2e8f0;color:#334155}.evr-bronze{background:#fed7aa;color:#7c2d12}
  .evr-status{font-size:.75rem;font-weight:600;border-radius:999px;padding:2px 8px;white-space:nowrap}
  .evr-ok{background:#dcfce7;color:#166534}.evr-bad{background:#fee2e2;color:#991b1b}.evr-muted{background:#f1f5f9;color:#475569}
  `;

  let timer = null;

  function ensureStyle() {
    if (document.getElementById('evrStyle')) return;
    const st = document.createElement('style'); st.id = 'evrStyle'; st.textContent = css; document.head.appendChild(st);
  }

  async function load(t) {
    const card = document.querySelector('#tab-results .event-detail-card');
    if (!card || !window.sb || !t) return;
    ensureStyle();
    let rows;
    try { rows = await fetchRows(t.tournament_id); }
    catch (e) { console.warn('[SwimFest] results:', e.message); return; }
    if (!rows.some(hasResult)) return;   // nothing swum yet: keep the "published live" note

    const people = await fetchPeople(rows.filter(hasResult));
    const events = buildEvents(rows, people);
    const open = new Set([...card.querySelectorAll('.evr-event[open] .evr-evno')].map(e => e.textContent));
    const first = !card.querySelector('.evr-event');
    const live = t.status === 'LOCKED';
    card.innerHTML = `<h2 class="detail-card-title"><i class="fas fa-poll"></i> Results</h2>
      <div class="evr-head">
        <span>${events.length} race${events.length === 1 ? '' : 's'} with results · tap a race to open it</span>
        ${live ? '<span class="evr-live">Live · updates every 30 seconds</span>' : ''}
      </div>
      ${events.map((ev, i) => eventHtml(ev, first ? i === 0 : open.has(`Event ${ev.no ?? '—'}`))).join('')}`;

    if (live && !timer) timer = setInterval(() => { if (!document.hidden) load(t); }, REFRESH_MS);
  }

  // The live board (live.js) reuses the same loading, ranking and tables
  window.SwimResults = {
    load, fetchRows, fetchPeople, buildEvents, eventHtml, ensureStyle, fmtTime, hasResult, genderLabel, css: () => css,
    _buildEvents: buildEvents, _render: eventHtml,
  };
})();
