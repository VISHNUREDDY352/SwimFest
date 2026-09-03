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

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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

    let query = window.sb
      .from('swimmer_directory')
      .select('swimmer_id, full_name, gender, category, academy_id, academy_name')
      .order('full_name')
      .limit(60);

    if (q)        query = query.ilike('full_name', `%${q}%`);
    if (category) query = query.eq('category', category);
    if (gender)   query = query.eq('gender', gender);
    if (academy)  query = query.eq('academy_id', academy);

    const { data, error } = await query;

    if (error) {
      console.error('[SwimFest] swimmer search:', error.message);
      results.innerHTML = `<div class="sp-empty"><i class="fas fa-triangle-exclamation"></i>
        <p>Search failed: ${esc(error.message)}</p></div>`;
      return;
    }

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

    meta.textContent = `${rows.length} swimmer${rows.length === 1 ? '' : 's'} found`;

    results.innerHTML = `<div class="sp-grid">` + rows.map((s) => {
      const academyName = s.academy_name || 'Unattached';
      const gCls = s.gender === 'Girl' ? 'girl' : 'boy';
      const gLabel = s.gender === 'Girl' ? 'Girl' : 'Boy';
      return `
        <div class="sp-card">
          <div class="sp-avatar">${esc(initials(s.full_name))}</div>
          <div class="sp-card-body">
            <h3 class="sp-name">${esc(s.full_name)}</h3>
            <p class="sp-academy"><i class="fas fa-building"></i> ${esc(academyName)}</p>
            <div class="sp-badges">
              ${s.category ? `<span class="sp-badge">${esc(s.category)}</span>` : ''}
              <span class="sp-badge ${gCls}">${gLabel}</span>
            </div>
          </div>
        </div>`;
    }).join('') + `</div>`;
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
