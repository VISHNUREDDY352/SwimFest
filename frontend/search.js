/* ============================================================
   SwimFest — Search Profile page   search.js
   Public swimmer directory search backed by Supabase.
   NOTE: requires a public-read RLS policy on `swimmers`
   (see db/public_swimmers.sql). Without it, anon users only
   see swimmers they own.
   ============================================================ */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);

  const esc = SF.esc;

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  // ── Populate the academy filter from the public academies table ──
  async function loadAcademies() {
    if (!window.sb) return;
    const { data, error } = await window.sb
      .from('academies')
      .select('academy_id, academy_name')
      .order('academy_name');
    if (error) { console.warn('[SwimFest] academies load:', error.message); return; }
    const sel = $('spAcademy');
    (data || []).forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.academy_id;
      opt.textContent = a.academy_name;
      sel.appendChild(opt);
    });
  }

  // ── Run the search ───────────────────────────────────────────
  async function runSearch() {
    const q        = $('spQuery').value.trim();
    const category = $('spCategory').value;
    const gender   = $('spGender').value;
    const academy  = $('spAcademy').value;
    const results  = $('spResults');
    const meta     = $('spMeta');

    if (!q && !category && !gender && !academy) {
      results.innerHTML = `<div class="sp-hint"><i class="fas fa-user-friends"></i>
        <p>Enter a name or pick a filter, then press Search.</p></div>`;
      meta.textContent = '';
      return;
    }

    if (!window.sb) {
      results.innerHTML = `<div class="sp-empty"><i class="fas fa-plug"></i>
        <p>Directory service unavailable. Please try again later.</p></div>`;
      return;
    }

    results.innerHTML = `<div class="sp-loading"><i class="fas fa-circle-notch fa-spin"></i>
      <p>Searching…</p></div>`;
    meta.textContent = '';

    // Name or swimmer ID (SFI number). The ID column exists once perf_and_bulk.sql has run.
    const build = withId => {
      let query = window.sb
        .from('swimmer_directory')
        .select(`swimmer_id, full_name, gender, category, academy_id, academy_name${withId ? ', sfi_serial_no' : ''}`)
        .order('full_name')
        .limit(100);
      const term = q.replace(/[,()%*]/g, ' ').trim();
      if (term) query = withId ? query.or(`full_name.ilike.%${term}%,sfi_serial_no.ilike.%${term}%`) : query.ilike('full_name', `%${term}%`);
      if (category) query = query.eq('category', category);
      if (gender)   query = query.eq('gender', gender);
      if (academy)  query = query.eq('academy_id', academy);
      return query;
    };
    let { data, error } = await build(true);
    if (error && /sfi_serial_no/.test(error.message)) ({ data, error } = await build(false));

    if (error) {
      console.error('[SwimFest] swimmer search:', error.message);
      results.innerHTML = `<div class="sp-empty"><i class="fas fa-triangle-exclamation"></i>
        <p>Search failed: ${esc(error.message)}</p></div>`;
      return;
    }

    // Name / ID matches that start with the typed text come first
    if (q) data = SF.Search.run(data || [], SF.Search.by(['full_name', 'sfi_serial_no'], ['academy_name']), q);
    render(data || [], meta, results);
  }

  function render(rows, meta, results) {
    if (!rows.length) {
      meta.textContent = '';
      results.innerHTML = `<div class="sp-empty"><i class="fas fa-user-slash"></i>
        <p>No swimmers matched your search.</p>
        <p style="font-size:0.82rem;margin-top:6px;">Try a different name or clear the filters.</p></div>`;
      return;
    }

    meta.textContent = `${rows.length} swimmer${rows.length === 1 ? '' : 's'} found${rows.length === 100 ? ' (showing the first 100; narrow the search)' : ''}`;

    results.innerHTML = `<div class="sf-section"><div class="sf-table-wrap"><table class="sf-table sf-stack">
      <caption class="sr-only">Swimmers matching your search</caption>
      <thead><tr><th scope="col">Swimmer</th><th scope="col">Swimmer ID</th><th scope="col">Academy</th><th scope="col">Age group</th><th scope="col">Gender</th></tr></thead>
      <tbody>` + rows.map((s) => `
        <tr>
          <td data-label="Swimmer"><strong>${esc(s.full_name)}</strong></td>
          <td data-label="Swimmer ID"><span class="sf-mono">${esc(s.sfi_serial_no || "—")}</span></td>
          <td data-label="Academy">${esc(s.academy_name || 'Unattached')}</td>
          <td data-label="Age group">${esc(s.category || '—')}</td>
          <td data-label="Gender">${s.gender === 'Girl' ? 'Girl' : 'Boy'}</td>
        </tr>`).join('') + `</tbody></table></div></div>`;
  }

  // ── Bootstrap ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadAcademies();

    $('spSearchBtn').addEventListener('click', runSearch);
    $('spQuery').addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
    ['spCategory', 'spGender', 'spAcademy'].forEach((id) => {
      $(id).addEventListener('change', runSearch);
    });

    // Honor ?q= deep link
    const param = new URLSearchParams(location.search).get('q');
    if (param) { $('spQuery').value = param; runSearch(); }
  });
})();
