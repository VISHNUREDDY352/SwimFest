/* ============================================================
   SwimFest — Heat generation page   heatgen.js
   Page controller only. The work is done by:
     SF.HeatEngine     seeding, lanes, event order, schedule (core/heatengine.js)
     SF.EntryRepo,
     SF.HeatRepo       reading entries, saving heats    (core/repos.js)
     SF.EntryImporter  spreadsheet import + template    (core/entryimport.js)
   ============================================================ */
'use strict';

(function () {
  const { esc, fmt } = SF;
  const $ = id => document.getElementById(id);
  const E = SF.HeatEngine;

  const STATUS = {
    PUBLISHED: ['Registration open', 'sf-badge-ok'], CLOSED: ['Registration closed', 'sf-badge-warn'],
    LOCKED: ['Player list locked', 'sf-badge-info'], CLOSURE_REQUESTED: ['Closure requested', 'sf-badge-warn'],
    COMPLETED: ['Completed', ''],
  };
  const IMPORTABLE = ['PUBLISHED', 'CLOSED'];

  // ── Page state ────────────────────────────────────────────
  const state = {
    meets: [], meet: null, entries: [], academies: null,
    saved: { heats: 0, results: 0 },
    events: [],          // generated, not necessarily saved
    dirty: false,        // generated or swapped since last save
    swapFrom: null,      // { ev, heat, lane } waiting for a second pick
  };

  // ── Rules ─────────────────────────────────────────────────
  function generateBlocker() {
    const m = state.meet;
    if (!m) return 'Pick a meet.';
    if (m.status === 'PUBLISHED' || m.status === 'CLOSED') {
      return `Lock the player list first. <a href="playerlist.html?t=${encodeURIComponent(m.tournament_id)}">Open the player list</a> and lock it when every entry is right.`;
    }
    if (m.status !== 'LOCKED') return 'This meet has finished racing, so its heats can\'t be changed.';
    if (state.saved.results) return `Results have already been entered for ${fmt.plural(state.saved.results, 'lane')}, so the heats can't be drawn again.`;
    if (!state.entries.length) return 'This meet has no race entries yet.';
    return '';
  }

  function pools() {
    const read = n => ({
      id: 'P' + n,
      label: $(`pool${n}Name`).value.trim() || `Pool ${n}`,
      lanes: parseInt((document.querySelector(`input[name="pool${n}Lanes"]:checked`) || {}).value || (n === 1 ? 8 : 6), 10),
      categories: [...document.querySelectorAll(`#pool${n}Categories input:checked`)].map(c => c.value),
    });
    return [1, 2].filter(n => $(`pool${n}Active`).checked).map(read);
  }

  const unrouted = () => {
    const p = pools();
    return state.entries.filter(e => !p.some(x => x.categories.includes(e.category)));
  };

  // ── Rendering: status chip + step guide ───────────────────
  // Each step is done, current (the one thing to do now) or still to come.
  const RACING = ['LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'];

  function stepStates() {
    const m = state.meet;
    const done = {
      meet: !!m,
      entries: !!m && state.entries.length > 0,
      lock: !!m && RACING.includes(m.status),
      generate: !!m && (state.events.length > 0 || state.saved.heats > 0),
      save: !!m && state.saved.heats > 0 && !state.dirty,
      race: !!m && m.status === 'COMPLETED',
    };
    const current = ['meet', 'entries', 'lock', 'generate', 'save', 'race'].find(k => !done[k]);
    return { done, current };
  }

  function setStep(key, st, text) {
    const li = document.querySelector(`#hgGuide [data-step="${key}"]`);
    li.dataset.state = st;
    if (st === 'current') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    if (text != null) li.querySelector('[data-text]').innerHTML = text;
  }

  function renderMeetState() {
    const m = state.meet;
    const [label, cls] = m ? (STATUS[m.status] || [m.status, '']) : ['—', ''];
    const chip = $('hgStatusChip');
    chip.className = 'sf-badge ' + cls;
    chip.textContent = label;

    const { done, current } = stepStates();
    const st = k => (done[k] ? 'done' : k === current ? 'current' : 'todo');
    const id = m ? encodeURIComponent(m.tournament_id) : '';
    const swimmers = new Set(state.entries.map(e => e.swimId)).size;
    const canImport = !!m && IMPORTABLE.includes(m.status);

    setStep('meet', st('meet'), m
      ? `${esc(m.title)}${m.start_date ? ' · ' + esc(SwimNav.dates(m.start_date, m.end_date)) : ''}`
      : 'Pick the meet you\'re drawing heats for.');

    setStep('entries', st('entries'), !m ? 'Import a spreadsheet, or add swimmers on the Player list.'
      : state.loading ? 'Loading entries…'
      : state.entries.length ? `${fmt.plural(swimmers, 'swimmer')} in ${fmt.plural(state.entries.length, 'race entry', 'race entries')}. They're listed below.`
      : canImport ? 'No entries yet. Download the template, fill in one row per swimmer per race, then import it. You\'ll see every row before anything is saved.'
      : 'This meet has no entries and its player list is locked. Unlock it on the Player list to add entries.');

    $('lockLink').href = `playerlist.html${m ? '?t=' + id : ''}`;
    setStep('lock', st('lock'), done.lock ? 'Locked. No new entries can come in.'
      : 'Check the list, then lock it. Locking stops new entries, so the heats won\'t change after you draw them.');

    const p = pools();
    const left = m ? unrouted().length : 0;
    const poolText = p.map(x => `${esc(x.label)} (${x.lanes} lanes, ${esc(x.categories.join(', ') || 'no age groups')})`).join(' and ');
    const seeding = (E.SEEDING[$('seedingSelect').value] || {}).label || 'standard seeding';
    let genText = `Using ${poolText}; ${esc(seeding.toLowerCase())}. Nothing is saved until the next step.`;
    if (left) genText += ` <strong style="color:var(--sf-bad)">${fmt.plural(left, 'entry', 'entries')} ${left === 1 ? 'has' : 'have'} no pool</strong>: tick their age group under Pools &amp; timing.`;
    if (state.saved.results) genText = `Results are already in for ${fmt.plural(state.saved.results, 'lane')}, so the heats can't be drawn again.`;
    else if (m && m.status === 'COMPLETED') genText = 'This meet has finished racing, so its heats can\'t be changed.';
    else if (state.saved.heats && !state.events.length) genText = `${fmt.plural(state.saved.heats, 'heat')} already saved. Generate again only if you need a new draw: saving replaces them.`;
    setStep('generate', st('generate'), genText);

    const heats = state.events.reduce((n, ev) => n + ev.heats.length, 0);
    setStep('save', st('save'), done.save ? `${fmt.plural(state.saved.heats, 'heat')} saved. They're on Race control, Live results and the public Heat sheets.`
      : state.events.length ? `${fmt.plural(heats, 'heat')} drawn and shown below, <strong>not saved yet</strong>. Swap lanes if needed, then save.`
      : 'Swap lanes if needed, then save. Saved heats go to Race control and the public Heat sheets.');

    $('raceLink').href = `orgracecontrol.html${m ? '?t=' + id : ''}`;
    $('resultsLink').href = `results.html${m ? '?t=' + id : ''}`;
    setStep('race', st('race'), done.race ? 'Racing is finished for this meet.' : 'Call heats poolside and enter times as each heat finishes.');

    const blocker = generateBlocker();
    $('generateBtn').disabled = !!blocker;
    $('generateBtn').title = blocker.replace(/<[^>]+>/g, '');
    $('guideRegenBtn').hidden = !!blocker;
    $('guideSaveBtn').disabled = !state.events.length;
    $('setupSection').hidden = !m || !done.lock || m.status === 'COMPLETED' || !!state.saved.results;
    $('entriesImportBtn').hidden = !canImport;
    $('importBtn').disabled = !canImport;
    $('importBtn').title = canImport ? 'Add swimmers and races from a spreadsheet' : 'Entries can only be imported before the player list is locked.';

    const imp = $('importResultsBtn');
    const canResults = m && state.saved.heats > 0;
    imp.setAttribute('aria-disabled', canResults ? 'false' : 'true');
    imp.href = canResults ? `results.html?t=${id}&import=1` : '#';
    imp.title = canResults ? 'Load finish times from the timing system into Live results' : 'Save heats first';

    renderEntries();
  }

  // ── Entries table: what's in the meet right now ──────────
  const ENTRY_LIMIT = 200;
  const emptyMsg = t => `<p style="padding:28px 16px;margin:0;text-align:center;color:var(--sf-muted)">${t}</p>`;
  function renderEntries() {
    const sec = $('entriesSection');
    sec.hidden = !state.meet || state.loading;
    if (sec.hidden) return;
    const cats = [...new Set(state.entries.map(e => e.category).filter(Boolean))].sort();
    const sel = $('entryCatFilter');
    const keep = sel.value;
    sel.innerHTML = '<option value="">All age groups</option>' + cats.map(c => `<option${c === keep ? ' selected' : ''}>${esc(c)}</option>`).join('');
    sel.hidden = cats.length < 2;

    const q = SF.norm($('entrySearch').value);
    const cat = sel.value;
    const rows = state.entries
      .filter(e => (!cat || e.category === cat) && (!q || SF.norm(`${e.name} ${e.academy} ${e.event}`).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name) || E.distanceOf(a.event) - E.distanceOf(b.event));
    const swimmers = new Set(state.entries.map(e => e.swimId)).size;
    $('entriesTitle').textContent = `Entries (${state.entries.length})`;
    $('entriesSub').textContent = state.entries.length ? `${fmt.plural(swimmers, 'swimmer')} · one row per swimmer per race` : '';
    $('entryCount').textContent = q || cat ? `${rows.length} of ${state.entries.length} shown` : '';

    if (!state.entries.length) { $('entriesTable').innerHTML = emptyMsg('No entries yet. Imported rows appear here straight away.'); return; }
    if (!rows.length) { $('entriesTable').innerHTML = emptyMsg('Nothing matches that search.'); return; }
    const group = e => `${e.gender === 'Girl' ? 'Girls' : e.gender === 'Boy' ? 'Boys' : ''} ${e.category || ''}`.trim();
    $('entriesTable').innerHTML = `<div class="sf-table-wrap" style="max-height:28rem;overflow:auto"><table class="sf-table sf-stack">
        <caption class="sf-visually-hidden">Race entries in this meet</caption>
        <thead><tr><th scope="col">Swimmer</th><th scope="col">Academy</th><th scope="col">Age group</th><th scope="col">Race</th><th scope="col" class="num">Seed</th></tr></thead>
        <tbody>${rows.slice(0, ENTRY_LIMIT).map(e => `<tr>
          <td data-label="Swimmer"><strong>${esc(e.name)}</strong></td>
          <td data-label="Academy">${esc(e.academy)}</td>
          <td data-label="Age group">${esc(group(e))}</td>
          <td data-label="Race">${esc(e.event)}${e.isRelay ? ' <span class="sf-badge">relay</span>' : ''}</td>
          <td data-label="Seed" class="num">${e.seedMs ? fmt.seed(e.seedMs) : '<span class="hg-nt">NT</span>'}</td>
        </tr>`).join('')}</tbody></table></div>
      ${rows.length > ENTRY_LIMIT ? `<p class="hg-entries-more">Showing the first ${ENTRY_LIMIT} of ${rows.length}. Search to find someone.</p>` : ''}`;
  }

  // ── Loading ───────────────────────────────────────────────
  async function loadMeets() {
    const sel = $('hgTournamentSelect');
    try {
      const { meets, limited } = await SF.TournamentRepo.listForStaff(Object.keys(STATUS));
      state.meets = meets;
      if (!meets.length) {
        sel.innerHTML = `<option value="">${limited ? 'No meets assigned to you yet' : 'No approved meets yet'}</option>`;
        sel.disabled = true;
        renderMeetState();
        return;
      }
      sel.innerHTML = SwimNav.meetOptions(meets);
      const pick = SwimNav.pickMeet(meets, t => t.status === 'LOCKED');
      sel.value = pick.tournament_id;
      await loadMeet(sel.value);
    } catch (e) {
      sel.innerHTML = '<option value="">Could not load meets</option>';
      SF.toast(SF.db.why(e), 'error');
    }
  }

  async function loadMeet(id) {
    state.meet = state.meets.find(t => t.tournament_id === id) || null;
    state.events = []; state.dirty = false; state.swapFrom = null;
    $('heatPreviewSection').hidden = true;
    $('exportCTSBtn').disabled = true;
    state.entries = []; state.saved = { heats: 0, results: 0 };
    renderMeetState();
    if (!state.meet) return;

    // Pool defaults from the meet
    const m = state.meet;
    if (m.lane_count) {
      const r = document.querySelector(`input[name="pool1Lanes"][value="${m.lane_count}"]`);
      if (r) r.checked = true;
    }
    if (Array.isArray(m.pool_lengths) && m.pool_lengths.length === 2) {
      $('pool1Name').value = '50 m pool';
      $('pool2Name').value = '25 m pool';
      $('pool2Active').checked = true;
    }
    syncPools();

    state.loading = true;
    renderMeetState();
    try {
      const [entries, saved] = await Promise.all([SF.EntryRepo.listForMeet(id), SF.HeatRepo.savedState(id)]);
      if (state.meet !== m) return;           // another meet was picked meanwhile
      state.entries = entries;
      state.saved = saved;
    } catch (e) {
      SF.toast('Could not load entries: ' + SF.db.why(e), 'error');
    }
    state.loading = false;
    renderMeetState();
  }

  // ── Pools UI ──────────────────────────────────────────────
  function syncPools() {
    const toggles = [$('pool1Active'), $('pool2Active')];
    const on = toggles.filter(t => t.checked).length;
    toggles.forEach((t, i) => {
      $(`pool${i + 1}Card`).dataset.off = t.checked ? 'false' : 'true';
      t.disabled = t.checked && on === 1;      // at least one pool stays on
      t.title = t.disabled ? 'At least one pool must stay on. Turn on the other pool first.' : '';
    });
    renderMeetState();
  }

  // ── Generate ──────────────────────────────────────────────
  function generate() {
    const blocker = generateBlocker();
    if (blocker) { renderMeetState(); SF.toast(blocker.replace(/<[^>]+>/g, ''), 'warn'); return; }
    const p = pools();
    if (p.some(x => !x.categories.length)) { SF.toast('Each pool you use needs at least one age group.', 'warn'); return; }

    const { events, unrouted: left } = E.generate(state.entries, p, { seeding: $('seedingSelect').value });
    const [sh, sm] = ($('sessionStart').value || '08:30').split(':').map(Number);
    const num = (id, d) => parseFloat($(id).value) || d;
    E.schedule(events, { start: sh * 60 + sm, buffers: { short: num('buf50', 2), mid: num('buf100', 3), long: num('buf400', 6), relay: num('bufRelay', 3.5) } });

    state.events = events; state.dirty = true; state.swapFrom = null;
    fillFilters();
    renderHeats();
    $('heatPreviewSection').hidden = false;
    $('exportCTSBtn').disabled = false;
    $('publishBtn').disabled = false;
    $('hgPreviewSubtitle').textContent = 'Not saved yet. Check the lanes, then save.';
    renderMeetState();

    const heats = events.reduce((n, ev) => n + ev.heats.length, 0);
    SF.toast(left.length
      ? `Drew ${fmt.plural(heats, 'heat')} in ${fmt.plural(events.length, 'event')}. ${fmt.plural(left.length, 'entry', 'entries')} have no pool and were left out.`
      : `Drew ${fmt.plural(heats, 'heat')} in ${fmt.plural(events.length, 'event')}.`, left.length ? 'warn' : 'success');
    $('heatPreviewSection').scrollIntoView({ block: 'start' });
    $('previewTitle').focus({ preventScroll: true });
  }

  function fillFilters() {
    const opts = (vals, all) => `<option value="">${all}</option>` + [...new Set(vals)].map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    $('previewPoolFilter').innerHTML = opts(state.events.map(e => e.poolLabel), 'All pools');
    $('previewEventFilter').innerHTML = opts(state.events.map(e => e.eventName).sort((a, b) => E.distanceOf(a) - E.distanceOf(b) || a.localeCompare(b)), 'All races');
    $('previewCatFilter').innerHTML = opts(state.events.map(e => e.category).sort(), 'All age groups');
    $('previewPoolFilter').hidden = new Set(state.events.map(e => e.poolLabel)).size < 2;
  }

  // ── Heats table (one row per lane, grouped by event and heat) ──
  const eventTitle = ev => `Event ${ev.eventNum} · ${ev.gender === 'Girl' ? 'Girls' : 'Boys'} ${ev.category} ${ev.eventName}`;
  const laneNames = l => l.team ? [l.name, ...l.members.map(m => m.name)] : [l.name];

  function renderHeats() {
    const fp = $('previewPoolFilter').value, fe = $('previewEventFilter').value, fc = $('previewCatFilter').value;
    const q = SF.norm($('heatSearch').value);
    const match = l => !q || (!l.empty && laneNames(l).some(n => SF.norm(n).includes(q)));

    let lanesShown = 0;
    const html = [];
    state.events.forEach((ev, ei) => {
      if ((fp && ev.poolLabel !== fp) || (fe && ev.eventName !== fe) || (fc && ev.category !== fc)) return;
      const heatRows = [];
      ev.heats.forEach((h, hi) => {
        const lanes = h.lanes.filter(l => (q ? match(l) : true));
        if (!lanes.length) return;
        heatRows.push(`<tr class="sf-group-row"><th colspan="5" scope="colgroup" style="background:var(--sf-subtle);color:var(--sf-text)">
          Heat ${h.heatNumber} of ${h.totalHeats}${h.isFastest && h.totalHeats > 1 ? ' · fastest heat' : ''} · starts about ${E.clock12(h.startMin)}</th></tr>`);
        lanes.forEach(l => {
          lanesShown++;
          const picked = state.swapFrom && state.swapFrom.ev === ei && state.swapFrom.heat === hi && state.swapFrom.lane === l.lane;
          const who = l.empty ? '<span class="hg-nt">Empty</span>'
            : l.team ? `<strong>${esc(l.name)}</strong>${l.short ? ' <span class="sf-badge sf-badge-warn">short team</span>' : ''}<span class="hg-members">${l.members.map(m => esc(m.name)).join(', ')}</span>`
            : esc(l.name);
          const seed = l.empty ? '' : l.seedMs ? fmt.seed(l.seedMs) : '<span class="hg-nt">NT</span>';
          heatRows.push(`<tr${l.empty ? ' class="hg-empty"' : ''}>
            <td class="num"><strong>${l.lane}</strong></td>
            <td>${who}${l.empty || l.team ? '' : `<span class="hg-members hg-show-sm">${esc(l.academy || '')}</span>`}</td>
            <td class="hg-hide-sm">${l.empty ? '' : esc(l.academy || '—')}</td>
            <td class="num">${seed}</td>
            <td>${state.meet && !state.saved.results
              ? `<button type="button" class="sf-btn sf-btn-sm hg-swap" data-swap="${ei}|${hi}|${l.lane}" aria-pressed="${picked}"
                   aria-label="${picked ? 'Cancel swap' : 'Swap'} lane ${l.lane}, heat ${h.heatNumber}, event ${ev.eventNum}">${picked ? 'Cancel' : 'Swap'}</button>` : ''}</td>
          </tr>`);
        });
      });
      if (!heatRows.length) return;
      html.push(`<tbody>
        <tr class="sf-group-row"><th colspan="5" scope="rowgroup">${esc(eventTitle(ev))}
          <span style="font-weight:400"> · ${esc(ev.poolLabel)} · ${fmt.plural(ev.isRelay ? ev.units : ev.totalEntries, ev.isRelay ? 'team' : 'swimmer')} · ${fmt.plural(ev.heats.length, 'heat')}</span></th></tr>
        ${heatRows.join('')}</tbody>`);
    });

    $('heatTable').innerHTML = html.length
      ? `<div class="sf-table-wrap"><table class="sf-table hg-table">
           <caption class="sf-visually-hidden">Heats and lanes</caption>
           <thead><tr><th scope="col" class="num">Lane</th><th scope="col">Swimmer</th><th scope="col" class="hg-hide-sm">Academy</th><th scope="col" class="num">Seed</th><th scope="col"><span class="sf-visually-hidden">Actions</span></th></tr></thead>
           ${html.join('')}</table></div>`
      : `<p class="sf-empty" style="padding:28px 16px;text-align:center;color:var(--sf-muted)">${q ? 'No swimmer matches that search.' : 'No events match these filters.'}</p>`;

    const heats = state.events.reduce((n, ev) => n + ev.heats.length, 0);
    $('genSummary').textContent = `${fmt.plural(state.events.length, 'event')} · ${fmt.plural(heats, 'heat')}${q ? ` · ${fmt.plural(lanesShown, 'lane')} match` : ''}`;
  }

  // ── Lane swap: pick a lane, then another lane in the same event ──
  function onSwap(btn) {
    const [ei, hi, lane] = btn.dataset.swap.split('|').map(Number);
    const from = state.swapFrom;
    if (!from) { state.swapFrom = { ev: ei, heat: hi, lane }; renderHeats(); focusSwap(ei, hi, lane); SF.toast('Now press Swap on the lane to swap with (same event).', 'info'); return; }
    if (from.ev === ei && from.heat === hi && from.lane === lane) { state.swapFrom = null; renderHeats(); focusSwap(ei, hi, lane); return; }
    if (from.ev !== ei) { SF.toast('Lanes can only be swapped within the same event.', 'warn'); return; }
    const ev = state.events[ei];
    const a = ev.heats[from.heat].lanes, b = ev.heats[hi].lanes;
    const A = a[from.lane - 1], B = b[lane - 1];
    a[from.lane - 1] = Object.assign({}, B, { lane: from.lane });
    b[lane - 1] = Object.assign({}, A, { lane });
    [ev.heats[from.heat], ev.heats[hi]].forEach(h => { h.count = h.lanes.filter(l => !l.empty).length; });
    state.swapFrom = null; state.dirty = true;
    $('hgPreviewSubtitle').textContent = 'Changed, not saved yet.';
    renderMeetState();
    $('publishBtn').disabled = false;
    renderHeats();
    focusSwap(ei, hi, lane);
    SF.toast(`Swapped lane ${from.lane} (heat ${from.heat + 1}) with lane ${lane} (heat ${hi + 1}).`, 'success');
  }
  const focusSwap = (ei, hi, lane) => { const b = document.querySelector(`[data-swap="${ei}|${hi}|${lane}"]`); if (b) b.focus(); };

  // ── Save ──────────────────────────────────────────────────
  function confirmSave() {
    if (!state.events.length) { SF.toast('Generate heats first.', 'warn'); return; }
    const rows = E.toHeatRows(state.events);
    if (!rows.length) { SF.toast('There are no swimmers in these heats to save.', 'warn'); return; }
    const heats = state.events.reduce((n, ev) => n + ev.heats.length, 0);
    SF.Dialog.open({
      title: 'Save heats',
      body: `<p style="margin:0">Save ${fmt.plural(heats, 'heat')} (${fmt.plural(rows.length, 'swimmer lane')}) as the official lane draw for <strong>${esc(state.meet.title)}</strong>?</p>
             <p class="sf-hint" style="margin:10px 0 0">They appear on Race control, Live results and the public Heat sheets.${state.saved.heats ? ' The heats saved earlier are replaced.' : ''} Swimmers aren't notified automatically.</p>`,
      actions: [{ label: 'Cancel' }, { label: 'Save heats', primary: true, onClick: (d, b) => save(d, b, rows, heats) }],
    });
  }

  async function save(dlg, btn, rows, heats) {
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await SF.HeatRepo.save(state.meet.tournament_id, rows);
      state.saved.heats = heats; state.dirty = false;
      dlg.close();
      $('hgPreviewSubtitle').textContent = 'Saved. These heats are on Race control, Live results and the Heat sheets page.';
      SF.toast(`Saved ${fmt.plural(heats, 'heat')}.`, 'success');
      renderMeetState();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Save heats';
      dlg.querySelector('.sf-dialog-body').insertAdjacentHTML('beforeend', `<p class="sf-note sf-note-bad" role="alert" style="margin-top:12px">${esc(SF.db.why(e))}</p>`);
      SF.HeatRepo.savedState(state.meet.tournament_id).then(s => { state.saved = s; renderMeetState(); }).catch(() => {});
    }
  }

  // ── Export for the timing system ──────────────────────────
  function exportCTS() {
    if (!state.events.length) return SF.toast('Generate heats first.', 'warn');
    const rows = [['Pool_ID', 'Pool_Name', 'Event_No', 'Category', 'Gender', 'Event_Name', 'Heat_No', 'Lane_No', 'Swimmer_ID', 'Swimmer_Name', 'Academy', 'Seed_Time']];
    state.events.forEach(ev => ev.heats.forEach(h => h.lanes.forEach(l => {
      const base = [ev.poolId, ev.poolLabel, ev.eventNum, ev.category, ev.gender, ev.eventName, h.heatNumber, l.lane];
      if (l.empty) rows.push([...base, '', '(Empty lane)', '', '']);
      else if (l.team) l.members.forEach(m => rows.push([...base, m.swimId, `${l.name}: ${m.name}`, l.academy, l.seedMs ? fmt.seed(l.seedMs) : 'NT']));
      else rows.push([...base, l.swimId, l.name, l.academy || '', fmt.seed(l.seedMs)]);
    })));
    SF.csv.download(`${(state.meet ? state.meet.title : 'SwimFest').replace(/[^\w-]+/g, '_')}_heats.csv`, rows);
    SF.toast('Heat file downloaded for the timing system.', 'success');
  }

  // ── Import entries (spreadsheet) ──────────────────────────
  async function openImport() {
    const m = state.meet;
    if (!m) return SF.toast('Pick a meet first.', 'warn');
    if (!IMPORTABLE.includes(m.status)) {
      return SF.toast('Entries can only be imported before the player list is locked. Unlock it on the player list first.', 'warn');
    }
    try {
      if (!state.academies) state.academies = await SF.AcademyRepo.listApproved();
    } catch (e) { state.academies = []; }
    new SF.EntryImporter().open({ meet: m, academies: state.academies });
  }

  // ── Start ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
    if (session) {
      const name = session.name || session.email || 'Signed in';
      $('sideName').textContent = name;
      $('sideInitials').textContent = String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD';
      $('sideRole').textContent = session.role === 'super_admin' ? 'Super Admin' : 'Admin';
    }
    if (window.SwimNav) window.SwimNav.applySuperAdmin({ nav: 'hgNav', brand: 'hgBrand', brandSub: 'hgBrandSub', userLink: 'sideUserLink', name: 'sideName', initials: 'sideInitials', role: 'sideRole' }, 'heatgen.html');

    $('seedingSelect').innerHTML = Object.entries(E.SEEDING).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join('');
    ['pool1Active', 'pool2Active'].forEach(id => $(id).addEventListener('change', syncPools));
    document.querySelectorAll('#pool1Categories input, #pool2Categories input').forEach(cb => cb.addEventListener('change', renderMeetState));
    syncPools();

    $('hgTournamentSelect').addEventListener('change', e => {
      if (state.dirty && state.events.length && !confirm('The heats you generated are not saved. Switch meet anyway?')) {
        e.target.value = state.meet.tournament_id; return;
      }
      loadMeet(e.target.value);
    });
    $('generateBtn').addEventListener('click', generate);
    $('publishBtn').addEventListener('click', confirmSave);
    $('exportCTSBtn').addEventListener('click', exportCTS);
    $('printBtn').addEventListener('click', () => (state.events.length ? window.print() : SF.toast('Generate heats first.', 'warn')));
    $('templateBtn').addEventListener('click', () => {
      const imp = new SF.EntryImporter();
      imp.ctx = { meet: state.meet };
      SF.Dialog.open({
        title: 'Entries template',
        body: `<p style="margin:0 0 10px">One row per swimmer per race. Fill it in, then use <strong>Import entries</strong>.</p>${state.meet ? `<p style="margin:0 0 10px">The template includes the rules for <strong>${esc(state.meet.title)}</strong>: its races per age group and the birth years for each age group.</p>` : ""}<ul>${imp.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`,
        actions: [
          { label: 'Download .xlsx', onClick: () => imp.downloadTemplate('xlsx') },
          { label: 'Download .csv', primary: true, onClick: () => imp.downloadTemplate('csv') },
        ],
      });
    });
    $('importBtn').addEventListener('click', openImport);
    $('importResultsBtn').addEventListener('click', e => {
      if (e.currentTarget.getAttribute('aria-disabled') === 'true') { e.preventDefault(); SF.toast('Save heats first, then import results from the timing system.', 'warn'); }
    });
    ['previewPoolFilter', 'previewEventFilter', 'previewCatFilter'].forEach(id => $(id).addEventListener('change', renderHeats));
    $('heatSearch').addEventListener('input', SF.debounce(renderHeats, 150));
    $('heatTable').addEventListener('click', e => { const b = e.target.closest('[data-swap]'); if (b) onSwap(b); });

    // After an import, reload and show the new rows straight away
    SF.bus.on('entries:imported', async () => {
      if (!state.meet) return;
      await loadMeet(state.meet.tournament_id);
      const sec = $('entriesSection');
      sec.classList.remove('sf-flash'); void sec.offsetWidth; sec.classList.add('sf-flash');
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('entriesImportBtn').addEventListener('click', openImport);
    $('entrySearch').addEventListener('input', SF.debounce(renderEntries, 150));
    $('entryCatFilter').addEventListener('change', renderEntries);
    $('guideSaveBtn').addEventListener('click', confirmSave);
    $('guideRegenBtn').addEventListener('click', generate);
    $('seedingSelect').addEventListener('change', renderMeetState);
    ['pool1Name', 'pool2Name'].forEach(id => $(id).addEventListener('input', SF.debounce(renderMeetState, 200)));
    document.querySelectorAll('input[name="pool1Lanes"], input[name="pool2Lanes"]').forEach(r => r.addEventListener('change', renderMeetState));
    $('setupBtn').addEventListener('click', () => {
      const sec = $('setupSection');
      sec.hidden = false;
      $('setupDetails').open = true;
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sec.querySelector('summary').focus({ preventScroll: true });
    });
    window.addEventListener('beforeunload', e => { if (state.dirty && state.events.length) { e.preventDefault(); e.returnValue = ''; } });

    // Mobile sidebar
    const setNav = open => { $('acShell').classList.toggle('nav-open', open); $('acMenuBtn').setAttribute('aria-expanded', String(open)); };
    $('acMenuBtn').addEventListener('click', () => setNav(!$('acShell').classList.contains('nav-open')));
    $('acScrim').addEventListener('click', () => setNav(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });

    loadMeets();
  });
})();
