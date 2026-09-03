/* ============================================================
   SwimFest — Organizer Profile   orgprofile.js
   Loads the logged-in organizer's account + organization + meet
   stats from Supabase and allows editing basic details.
   ============================================================ */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  let session = null;
  let profile = null;    // profiles row
  let org     = null;    // academies row for this organizer (if any)

  function initials(name){
    const p = String(name||'').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0]||'') + (p[1]?.[0]||'')).toUpperCase() || 'O';
  }

  async function load() {
    session = window.SwimAuth ? window.SwimAuth.getSession() : null;
    if (!session) return;

    const name = session.name || 'Organizer';
    $('opName').textContent = name;
    $('opAvatar').textContent = initials(name);

    if (!window.sb) return;

    // Profile row
    if (session.userId) {
      const { data: p } = await window.sb.from('profiles').select('*').eq('id', session.userId).maybeSingle();
      profile = p || null;
    }

    // Their organization — from the dedicated organizers table (own row via owner_id)
    if (session.userId) {
      const { data: o } = await window.sb.from('organizers').select('*').eq('owner_id', session.userId).maybeSingle();
      org = o || null;
    }

    renderDetails();
    renderOrg();
    await renderStats();
  }

  function renderDetails() {
    $('opOrgLine').textContent = org ? org.org_name : 'No organization on file';
    $('opDetails').innerHTML = `
      <div class="op-detail"><span class="op-detail-label">Contact Person</span><span class="op-detail-value">${esc(session.name || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Email</span><span class="op-detail-value">${esc(session.email || (profile && profile.email) || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Phone</span><span class="op-detail-value">${esc((profile && profile.phone) || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Role</span><span class="op-detail-value">Event Organizer</span></div>`;
  }

  function renderOrg() {
    if (!org) {
      $('opOrg').innerHTML = `<div class="op-detail" style="grid-column:1/-1;"><span class="op-detail-value" style="color:var(--gray);font-weight:500;">No organization registered yet. It will appear here after you sign up as an organizer or an admin adds it.</span></div>`;
      return;
    }
    const statusCls = org.status === 'APPROVED_ACTIVE' ? 'active' : 'pending';
    const statusLbl = org.status === 'APPROVED_ACTIVE' ? 'Verified' : (org.status === 'PENDING_VERIFICATION' ? 'Pending Verification' : org.status);
    $('opOrg').innerHTML = `
      <div class="op-detail"><span class="op-detail-label">Organization</span><span class="op-detail-value">${esc(org.org_name)}</span></div>
      <div class="op-detail"><span class="op-detail-label">City</span><span class="op-detail-value">${esc(org.city || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Registration No.</span><span class="op-detail-value">${esc(org.registration_no || '—')}</span></div>
      <div class="op-detail"><span class="op-detail-label">Status</span><span class="op-detail-value"><span class="op-badge ${statusCls}">${esc(statusLbl)}</span></span></div>`;
  }

  async function renderStats() {
    let total = 0, published = 0, completed = 0, entries = 0;
    if (window.sb && session.userId) {
      const { data: mine } = await window.sb.from('tournaments')
        .select('tournament_id, status').eq('created_by', session.userId);
      const rows = mine || [];
      total = rows.length;
      published = rows.filter(t => t.status === 'PUBLISHED' || t.status === 'LOCKED').length;
      completed = rows.filter(t => t.status === 'COMPLETED').length;
      const ids = rows.map(r => r.tournament_id);
      if (ids.length) {
        const { data: ent } = await window.sb.from('event_entries').select('entry_id, tournament_id').in('tournament_id', ids);
        entries = (ent || []).length;
      }
    }
    $('opStats').innerHTML = `
      <div class="op-stat"><div class="op-stat-num">${total}</div><div class="op-stat-label">Events Created</div></div>
      <div class="op-stat"><div class="op-stat-num">${published}</div><div class="op-stat-label">Live Now</div></div>
      <div class="op-stat"><div class="op-stat-num">${completed}</div><div class="op-stat-label">Completed</div></div>
      <div class="op-stat"><div class="op-stat-num">${entries}</div><div class="op-stat-label">Total Entries</div></div>`;
  }

  // ── Edit modal ──
  function openEdit() {
    $('editName').value    = session.name || '';
    $('editPhone').value   = (profile && profile.phone) || '';
    $('editOrgName').value = org ? org.org_name : '';
    $('editCity').value    = org ? (org.city || '') : '';
    $('opEditModal').classList.add('active');
  }
  function closeEdit() { $('opEditModal').classList.remove('active'); }

  async function saveEdit() {
    const name  = $('editName').value.trim();
    const phone = $('editPhone').value.trim();
    const orgName = $('editOrgName').value.trim();
    const city  = $('editCity').value.trim();
    if (!window.sb) { closeEdit(); return; }

    // Update profile (name + phone)
    if (session.userId) {
      await window.sb.from('profiles').update({ full_name: name, phone }).eq('id', session.userId);
    }
    // Update / mirror session name locally
    try {
      const key = 'swimfest_session';
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (raw) { const s = JSON.parse(raw); s.name = name; s.phone = phone;
        (localStorage.getItem(key) ? localStorage : sessionStorage).setItem(key, JSON.stringify(s)); session = s; }
    } catch (_) {}

    // Update organization if we have one
    if (org && orgName) {
      await window.sb.from('organizers').update({ org_name: orgName, city, contact_person: name, phone_number: phone })
        .eq('organizer_id', org.organizer_id);
      org.org_name = orgName; org.city = city;
    }

    closeEdit();
    // Re-render
    $('opName').textContent = name;
    $('opAvatar').textContent = initials(name);
    renderDetails();
    renderOrg();
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    $('opEditBtn').addEventListener('click', openEdit);
    $('opModalClose').addEventListener('click', closeEdit);
    $('opCancelBtn').addEventListener('click', closeEdit);
    $('opSaveBtn').addEventListener('click', saveEdit);
    $('opEditModal').addEventListener('click', (e) => { if (e.target === $('opEditModal')) closeEdit(); });
  });
})();
