/* ============================================================
   SwimFest — Super Admin Profile   saprofile.js
   ============================================================ */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  let session = null;
  let profile = null;

  function initials(name){
    const p = String(name||'').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0]||'') + (p[1]?.[0]||'')).toUpperCase() || 'SA';
  }

  async function load() {
    session = window.SwimAuth ? window.SwimAuth.getSession() : null;
    if (!session) return;
    renderName();

    if (!window.sb) return;
    if (session.userId) {
      const { data: p } = await window.sb.from('profiles').select('*').eq('id', session.userId).maybeSingle();
      profile = p || null;
    }
    renderDetails();
    await renderStats();
  }

  function renderName() {
    const name = session.name || 'Super Admin';
    $('saName').textContent = name;
    $('saAvatar').textContent = initials(name);
    $('saEmail').textContent = session.email || 'Super administrator';
    $('sideName').textContent = name;
    $('sideInitials').textContent = initials(name);
  }

  function renderDetails() {
    const rows = [
      ['Full name', session.name || '—'],
      ['Email',     session.email || '—'],
      ['Phone',     (profile && profile.phone) || '—'],
    ];
    $('saDetails').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  }

  async function renderStats() {
    const count = q => q.then(r => (r.error ? '—' : (r.count ?? 0).toLocaleString('en-IN')));
    const [meets, pending, academies, swimmers] = await Promise.all([
      count(window.sb.from('tournaments').select('tournament_id', { count: 'exact', head: true })),
      count(window.sb.from('tournaments').select('tournament_id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL')),
      count(window.sb.from('academies').select('academy_id', { count: 'exact', head: true })),
      count(window.sb.from('swimmer_directory').select('swimmer_id', { count: 'exact', head: true })),
    ]);
    $('statMeets').textContent = meets;
    $('statPending').textContent = pending;
    $('statAcademies').textContent = academies;
    $('statSwimmers').textContent = swimmers;
  }

  // ── Edit modal ──
  function openEdit() {
    $('saEditName').value  = session.name || '';
    $('saEditPhone').value = (profile && profile.phone) || '';
    $('saEditError').textContent = '';
    $('saEditModal').classList.add('active');
    $('saEditModal').style.display = 'flex';
    $('saEditName').focus();
  }
  function closeEdit() {
    $('saEditModal').classList.remove('active');
    $('saEditModal').style.display = 'none';
  }

  async function saveEdit() {
    const name  = $('saEditName').value.trim();
    const phone = $('saEditPhone').value.trim();
    const err = msg => { $('saEditError').textContent = msg; };
    if (!name) return err('Enter your name.');
    if (phone && !/^[\d\s+\-]{8,15}$/.test(phone)) return err('Enter a valid phone number.');
    if (!window.sb || !session.userId) return err('Not connected. Refresh the page and try again.');

    $('saSaveBtn').disabled = true;
    const { error } = await window.sb.from('profiles').update({ full_name: name, phone }).eq('id', session.userId);
    $('saSaveBtn').disabled = false;
    if (error) return err('Could not save: ' + error.message);

    // Keep the stored session's name in step
    try {
      const key = 'swimfest_session';
      const store = localStorage.getItem(key) ? localStorage : sessionStorage;
      const raw = store.getItem(key);
      if (raw) { const s = JSON.parse(raw); s.name = name; s.phone = phone; store.setItem(key, JSON.stringify(s)); session = s; }
    } catch (_) { session.name = name; }
    if (profile) profile.phone = phone;

    closeEdit();
    renderName();
    renderDetails();
  }

  function setNavOpen(open) {
    $('acShell').classList.toggle('nav-open', open);
    $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    $('saEditBtn').addEventListener('click', openEdit);
    $('saModalClose').addEventListener('click', closeEdit);
    $('saCancelBtn').addEventListener('click', closeEdit);
    $('saSaveBtn').addEventListener('click', saveEdit);
    $('saEditModal').addEventListener('click', (e) => { if (e.target === $('saEditModal')) closeEdit(); });
    $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
    $('acScrim').addEventListener('click', () => setNavOpen(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { setNavOpen(false); closeEdit(); } });
  });
})();
