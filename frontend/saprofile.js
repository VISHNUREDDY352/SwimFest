/* ============================================================
   SwimFest — Super Admin Profile   saprofile.js
   ============================================================ */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  let session = null;
  let profile = null;

  function initials(name){
    const p = String(name||'').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0]||'') + (p[1]?.[0]||'')).toUpperCase() || 'SA';
  }

  async function load() {
    session = window.SwimAuth ? window.SwimAuth.getSession() : null;
    if (!session) return;

    const name = session.name || 'Super Admin';
    $('saName').textContent = name;
    $('saAvatar').textContent = initials(name);
    $('saEmail').textContent = session.email || '';

    if (!window.sb) return;

    if (session.userId) {
      const { data: p } = await window.sb.from('profiles').select('*').eq('id', session.userId).maybeSingle();
      profile = p || null;
    }

    renderDetails();
    await renderStats();
  }

  function renderDetails() {
    $('saDetails').innerHTML = `
      <div class="op-detail"><span class="op-detail-label">Full Name</span><span class="op-detail-value">${esc(session.name || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Email</span><span class="op-detail-value">${esc(session.email || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Phone</span><span class="op-detail-value">${esc((profile && profile.phone) || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Role</span><span class="op-detail-value"><span class="op-badge active">Super Administrator</span></span></div>`;
  }

  async function renderStats() {
    let meets = 0, academies = 0, swimmers = 0, pending = 0;
    if (window.sb) {
      try {
        const [m, a, s, p] = await Promise.all([
          window.sb.from('tournaments').select('tournament_id', { count:'exact', head:true }),
          window.sb.from('academies').select('academy_id', { count:'exact', head:true }),
          window.sb.from('swimmer_directory').select('swimmer_id', { count:'exact', head:true }),
          window.sb.from('tournaments').select('tournament_id', { count:'exact', head:true }).eq('status', 'PENDING_APPROVAL'),
        ]);
        meets = m.count ?? 0; academies = a.count ?? 0; swimmers = s.count ?? 0; pending = p.count ?? 0;
      } catch (_) {}
    }
    $('saStats').innerHTML = `
      <div class="op-stat"><div class="op-stat-num">${meets}</div><div class="op-stat-label">Total Meets</div></div>
      <div class="op-stat"><div class="op-stat-num">${academies}</div><div class="op-stat-label">Academies</div></div>
      <div class="op-stat"><div class="op-stat-num">${swimmers.toLocaleString('en-IN')}</div><div class="op-stat-label">Swimmers</div></div>
      <div class="op-stat"><div class="op-stat-num">${pending}</div><div class="op-stat-label">Pending Approval</div></div>`;
  }

  // ── Edit modal ──
  function openEdit() {
    $('saEditName').value  = session.name || '';
    $('saEditPhone').value = (profile && profile.phone) || '';
    $('saEditModal').classList.add('active');
  }
  function closeEdit() { $('saEditModal').classList.remove('active'); }

  async function saveEdit() {
    const name  = $('saEditName').value.trim();
    const phone = $('saEditPhone').value.trim();
    if (!window.sb) { closeEdit(); return; }

    if (session.userId) {
      await window.sb.from('profiles').update({ full_name: name, phone }).eq('id', session.userId);
    }
    // Update the local session mirror
    try {
      const key = 'swimfest_session';
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (raw) { const s = JSON.parse(raw); s.name = name; s.phone = phone;
        (localStorage.getItem(key) ? localStorage : sessionStorage).setItem(key, JSON.stringify(s)); session = s; }
    } catch (_) {}

    closeEdit();
    $('saName').textContent = name;
    $('saAvatar').textContent = initials(name);
    renderDetails();
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    $('saEditBtn').addEventListener('click', openEdit);
    $('saModalClose').addEventListener('click', closeEdit);
    $('saCancelBtn').addEventListener('click', closeEdit);
    $('saSaveBtn').addEventListener('click', saveEdit);
    $('saEditModal').addEventListener('click', (e) => { if (e.target === $('saEditModal')) closeEdit(); });
  });
})();
