/* ============================================================
   SwimFest – public live timing board (live.html?t=<tournament_id>)
   Goes live once the player list is locked:
     • LIVE NOW banner: the heat in the water, per pool
     • lanes 1–N with swimmer, academy, seed and finish time as
       officials record them (refreshes every 10 seconds)
     • what's up next
     • official result books (after "Publish event results"),
       each downloadable as a PDF
   Uses the loading and ranking in eventresults.js.
   ============================================================ */
(function () {
  'use strict';

  const POLL_MS = 10000;
  const LIVE = ['LOCKED', 'CLOSURE_REQUESTED'];
  const R = window.SwimResults;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const DQ = { FS: 'False start', IT: 'Illegal turn', IS: 'Illegal stroke', IK: 'Illegal kick', OT: 'One-hand touch', LV: 'Lane violation', ET: 'Early take-off' };

  const params = new URLSearchParams(location.search);
  const TID = params.get('t') || params.get('id');
  let MEET = null, timer = null, busy = false;
  let seen = null;          // heat rows that already had a result last time (to highlight new times)
  let EVENTS_BY_KEY = {};   // published events, for the PDF buttons
  let lastUpdate = null;    // when the times were last fetched
  let lost = false;         // last fetch failed

  // Running clock + "updated Ns ago", redrawn every second
  function tick() {
    const now = new Date();
    const clock = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const ago = lastUpdate ? Math.max(0, Math.round((now - lastUpdate) / 1000)) : null;
    $('lvTickText').textContent = lost
      ? `Live · ${clock} · connection lost, retrying…`
      : `Live · ${clock}${ago == null ? '' : ` · updated ${ago < 2 ? 'just now' : ago + 's ago'}`}`;
  }

  function state(icon, title, text) {
    $('lvBody').innerHTML = `<div class="lv-state"><i class="fas fa-${icon}"></i><strong>${esc(title)}</strong>${esc(text || '')}</div>`;
  }

  function heatTitle(row) {
    const ee = row.event_entries || {};
    return `${R.genderLabel(ee.gender)} ${ee.category || ''} ${ee.event_name || ''}`.replace(/\s+/g, ' ').trim();
  }

  // Heats in race order for each pool: [{ pool, heats: [{ key, eventNo, heatNo, title, rows, of }] }]
  function groupHeats(rows) {
    const pools = new Map();
    rows.forEach(r => {
      const pool = r.pool_label || 'Pool';
      if (!pools.has(pool)) pools.set(pool, new Map());
      const heats = pools.get(pool);
      const key = `${r.event_no}|${r.heat_number}`;
      if (!heats.has(key)) heats.set(key, { key: `${pool}|${key}`, eventNo: r.event_no, heatNo: r.heat_number, title: heatTitle(r), rows: [] });
      heats.get(key).rows.push(r);
    });
    return [...pools.entries()].map(([pool, map]) => {
      const heats = [...map.values()].sort((a, b) => (a.eventNo - b.eventNo) || (a.heatNo - b.heatNo));
      const perEvent = {};
      heats.forEach(h => { perEvent[h.eventNo] = Math.max(perEvent[h.eventNo] || 0, h.heatNo); });
      heats.forEach(h => { h.of = perEvent[h.eventNo]; h.done = h.rows.every(R.hasResult); h.started = h.rows.some(R.hasResult); });
      return { pool, heats };
    });
  }

  function laneHtml(lane, row, person, place) {
    if (!row) return `<div class="lv-lane is-empty"><span class="lv-lane-no">${lane}</span><span>Empty lane</span><span></span></div>`;
    const ee = row.event_entries || {};
    const fresh = seen && R.hasResult(row) && !seen.has(row.heat_row_id);
    let right;
    if (row.status === 'DQ') right = `<span class="lv-flag">DQ${row.dq_code ? ` · ${esc(DQ[row.dq_code] || row.dq_code)}` : ''}</span>`;
    else if (row.status === 'DNS' || row.status === 'DNF') right = `<span class="lv-flag is-muted">${row.status}</span>`;
    else if (row.finish_time_ms != null) right = `<span class="lv-time${fresh ? ' is-new' : ''}">${R.fmtTime(row.finish_time_ms)}${place ? `<span class="lv-place">${ordinal(place)} in heat</span>` : ''}</span>`;
    else right = `<span class="lv-time is-wait">${ee.seed_time_ms ? `Seed ${R.fmtTime(ee.seed_time_ms)}` : 'Seed NT'}</span>`;
    return `<div class="lv-lane">
      <span class="lv-lane-no">${lane}</span>
      <span><span class="lv-name">${esc(person.full_name || 'Swimmer')}</span><br><span class="lv-acad">${esc(person.academy_name || 'Unattached')}</span></span>
      ${right}
    </div>`;
  }

  function poolHtml(group, people, laneCount, multiPool) {
    const i = group.heats.findIndex(h => !h.done);
    const tag = multiPool ? `<span class="lv-pool-tag">${esc(group.pool)}</span>` : '';
    if (i < 0) {
      return `<div class="lv-now"><div class="lv-now-label">${tag ? esc(group.pool) + ' · ' : ''}Finished</div>
        <p class="lv-now-title">Every heat${multiPool ? ' in this pool' : ''} has been swum</p></div>`;
    }
    const h = group.heats[i], next = group.heats[i + 1];
    const label = h.started || group.heats.slice(0, i).some(x => x.done) ? 'Live now' : 'First race';
    const byLane = Object.fromEntries(h.rows.map(r => [r.lane_number, r]));
    const timed = h.rows.filter(r => r.status === 'OK' && r.finish_time_ms != null).sort((a, b) => a.finish_time_ms - b.finish_time_ms);
    // Place in this heat so far (equal times share a place)
    const place = r => r.status === 'OK' && r.finish_time_ms != null ? 1 + timed.filter(x => x.finish_time_ms < r.finish_time_ms).length : 0;
    const lanes = Math.max(laneCount, ...h.rows.map(r => r.lane_number));
    let html = `<div class="lv-now">
        <div class="lv-now-label">${label}${multiPool ? ' · ' + esc(group.pool) : ''}</div>
        <p class="lv-now-title">Event ${h.eventNo} · ${esc(h.title)} (Heat ${h.heatNo} of ${h.of})</p>
        <div class="lv-now-meta">${h.rows.filter(R.hasResult).length} of ${h.rows.length} swimmers finished</div>
      </div>
      <div class="lv-lanes">`;
    for (let l = 1; l <= lanes; l++) {
      const row = byLane[l];
      html += laneHtml(l, row, row ? (people[(row.event_entries || {}).swimmer_id] || {}) : {}, row ? place(row) : 0);
    }
    html += `</div><p class="lv-next">${next ? `<b>Up next:</b> Event ${next.eventNo} · ${esc(next.title)}, heat ${next.heatNo} of ${next.of}` : 'This is the last heat.'}</p>`;
    return html;
  }

  function booksHtml(events, live) {
    const published = events.filter(ev => ev.published);
    EVENTS_BY_KEY = {};
    published.forEach((ev, i) => { EVENTS_BY_KEY[i] = ev; });
    const waiting = events.filter(ev => ev.done && !ev.published).length;
    let html = `<h2 class="lv-section-title"><i class="fas fa-book"></i> Official results</h2>`;
    if (!published.length) {
      html += `<div class="lv-state"><i class="fas fa-hourglass-half"></i><strong>No official results yet</strong>
        ${live ? 'Each race appears here, with a PDF result sheet, once the officials publish it.' : 'Results appear here once the officials publish them.'}
        ${waiting ? `<br>${waiting} race${waiting === 1 ? ' has' : 's have'} been swum and ${waiting === 1 ? 'is' : 'are'} being checked.` : ''}</div>`;
      return html;
    }
    html += published.map((ev, i) => `
      <div class="lv-book">
        <div style="flex:1;min-width:16rem;">${R.eventHtml(ev, false)}</div>
      </div>
      <div style="margin:-4px 0 12px;text-align:right;">
        <button type="button" class="lv-pdf" data-pdf="${i}"><i class="fas fa-file-pdf"></i> Result sheet (PDF)</button>
      </div>`).join('');
    if (waiting) html += `<p class="lv-next">${waiting} more race${waiting === 1 ? ' has' : 's have'} been swum and ${waiting === 1 ? 'is' : 'are'} being checked before publishing.</p>`;
    return html;
  }

  // A printable result sheet; the browser's "Save as PDF" makes the file
  function printBook(ev) {
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups for this site to download the result sheet.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(MEET.title)} – Event ${ev.no} ${esc(ev.title)}</title>
      <style>${R.css()}
        body{font-family:Inter,Arial,sans-serif;color:#0f172a;margin:24px}
        h1{font-size:18px;margin:0}.meta{color:#64748b;font-size:12px;margin:4px 0 16px}
        .evr-event summary::after{display:none}.evr-table{min-width:0}
        @page{size:A4 landscape;margin:12mm}</style></head>
      <body><h1>${esc(MEET.title)}</h1>
      <div class="meta">${esc(MEET.venue_name || '')}${MEET.city ? ', ' + esc(MEET.city) : ''} · Official results · printed ${new Date().toLocaleString('en-IN')}</div>
      ${R.eventHtml(ev, true)}
      <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  }

  async function refresh() {
    if (busy || !MEET) return;
    busy = true;
    try {
      const rows = await R.fetchRows(MEET.tournament_id);
      if (!rows.length) {
        state('layer-group', 'Heats haven\'t been drawn yet', 'The live board fills in as soon as the officials save the heats.');
        return;
      }
      const people = await R.fetchPeople(rows);
      const live = LIVE.includes(MEET.status);
      const groups = groupHeats(rows);
      const laneCount = MEET.lane_count || 8;
      let html = live ? groups.map(g => poolHtml(g, people, laneCount, groups.length > 1)).join('') : '';
      html += booksHtml(R.buildEvents(rows, people), live);
      // Keep open the races someone was reading
      const open = new Set([...document.querySelectorAll('.evr-event[open] .evr-evno')].map(e => e.textContent));
      $('lvBody').innerHTML = html;
      document.querySelectorAll('.evr-event').forEach(d => { if (open.has(d.querySelector('.evr-evno').textContent)) d.open = true; });
      seen = new Set(rows.filter(R.hasResult).map(r => r.heat_row_id));
      lastUpdate = new Date();
      lost = false;
      tick();
    } catch (e) {
      console.warn('[SwimFest] live board:', e.message);
      lost = true;
      tick();
    } finally {
      busy = false;
    }
  }

  async function start() {
    R.ensureStyle();
    if (!TID || !window.sb) { state('circle-question', 'Meet not found', 'Open the live board from a meet page.'); return; }
    const { data } = await window.sb.from('tournaments').select('*').eq('tournament_id', TID).maybeSingle();
    if (!data) { state('circle-question', 'Meet not found', 'This link may be out of date.'); return; }
    MEET = data;
    document.title = `Live: ${MEET.title} | SwimFest`;
    $('lvTitle').textContent = MEET.title;
    $('lvSub').textContent = [`${fmtDate(MEET.start_date)} – ${fmtDate(MEET.end_date)}`, MEET.venue_name, MEET.city].filter(Boolean).join(' · ');
    $('lvBack').href = `event.html?id=${encodeURIComponent(MEET.tournament_id)}`;

    const phase = window.SwimMeetState ? window.SwimMeetState.phase(MEET) : null;
    const liveNow = phase === 'ongoing' ? LIVE.includes(MEET.status) || MEET.status === 'PUBLISHED'
      : phase === 'upcoming' && LIVE.includes(MEET.status);
    if (phase === 'past') MEET.status = 'COMPLETED';   // dates are over: results mode, no live banner
    if (liveNow) {
      MEET.status = 'LOCKED';                         // draw the live board
      $('lvTick').hidden = false;
      tick();
      setInterval(tick, 1000);
      await refresh();
      timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    } else if (MEET.status === 'COMPLETED') {
      await refresh();
    } else {
      state('flag-checkered', 'Live timing hasn\'t started yet',
        `It starts here once the player list is locked, before racing on ${fmtDate(MEET.start_date)}. Keep this page open or come back on race day.`);
    }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pdf]');
    if (b && EVENTS_BY_KEY[b.dataset.pdf]) printBook(EVENTS_BY_KEY[b.dataset.pdf]);
  });
  document.addEventListener('DOMContentLoaded', () => {
    $('lvRefresh').addEventListener('click', refresh);
    start();
  });
})();
