/* ============================================================
   SwimFest — Organizer Profile   orgprofile.js
   Loads the logged-in organizer's account + organization + meet
   stats from Supabase and allows editing basic details.
   ============================================================ */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  let session = null;
  let profile = null;    // profiles row
  let org     = null;    // organizers row owned by this account (if any)

  const ORG_STATUS = {
    APPROVED_ACTIVE:      ['Verified', 'ac-pill-live'],
    PENDING_VERIFICATION: ['Waiting for verification', 'ac-pill-wait'],
    REJECTED:             ['Not approved', 'ac-pill-bad'],
  };

  function initials(name){
    const p = String(name||'').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0]||'') + (p[1]?.[0]||'')).toUpperCase() || 'O';
  }

  async function load() {
    session = window.SwimAuth ? window.SwimAuth.getSession() : null;
    if (!session) return;
    renderName();

    if (!window.sb || !session.userId) return;
    const [{ data: p }, { data: o }] = await Promise.all([
      window.sb.from('profiles').select('*').eq('id', session.userId).maybeSingle(),
      window.sb.from('organizers').select('*').eq('owner_id', session.userId).maybeSingle(),
    ]);
    profile = p || null;
    org = o || null;

    renderName();
    renderDetails();
    renderOrg();
    await renderStats();
  }

  function renderName() {
    const name = session.name || 'Organizer';
    $('opName').textContent = name;
    $('opAvatar').textContent = initials(name);
    $('opOrgLine').textContent = org ? org.org_name : 'No organization on file yet';
    const sideName = org && org.org_name ? org.org_name : name;
    $('sideName').textContent = sideName;
    $('sideInitials').textContent = initials(sideName);
    $('sideRole').textContent = session.role === 'super_admin' ? 'Super Admin' : 'Organizer';
  }

  function renderDetails() {
    const rows = [
      ['Name',  session.name || '—'],
      ['Email', session.email || (profile && profile.email) || '—'],
      ['Phone', (profile && profile.phone) || '—'],
      ['Role',  session.role === 'super_admin' ? 'Super admin' : 'Event organizer'],
    ];
    $('opDetails').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  }

  function renderOrg() {
    const pill = $('orgStatus');
    if (!org) {
      pill.hidden = true;
      $('opOrg').innerHTML = `<p class="op-empty">No organization on file. Use <strong>Edit profile</strong> to add your club or organization. The super admin verifies it before it's shown as verified.</p>`;
      return;
    }
    const [label, cls] = ORG_STATUS[org.status] || [org.status, 'ac-pill-draft'];
    pill.hidden = false;
    pill.className = `ac-pill ${cls}`;
    pill.textContent = label;
    const rows = [
      ['Organization',      org.org_name],
      ['Contact person',    org.contact_person || '—'],
      ['City',              org.city || '—'],
      ['Registration no.',  org.registration_no || '—'],
    ];
    $('opOrg').innerHTML = `<dl class="op-list">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  }

  async function renderStats() {
    const { data: mine } = await window.sb.from('tournaments')
      .select('tournament_id, status').eq('created_by', session.userId);
    const rows = mine || [];
    $('statTotal').textContent = rows.length;
    $('statLive').textContent  = rows.filter(t => ['PUBLISHED', 'CLOSED', 'LOCKED'].includes(t.status)).length;
    $('statDone').textContent  = rows.filter(t => t.status === 'COMPLETED').length;
    let entries = 0;
    const ids = rows.map(r => r.tournament_id);
    if (ids.length) {
      const { count } = await window.sb.from('event_entries')
        .select('entry_id', { count: 'exact', head: true }).in('tournament_id', ids);
      entries = count || 0;
    }
    $('statEntries').textContent = entries;
  }

  // ── Edit modal ──
  function openEdit() {
    $('editName').value    = session.name || '';
    $('editPhone').value   = (profile && profile.phone) || '';
    $('editOrgName').value = org ? org.org_name : '';
    $('editCity').value    = org ? (org.city || '') : '';
    $('opEditError').textContent = '';
    $('opEditModal').classList.add('active');
    $('opEditModal').style.display = 'flex';
    $('editName').focus();
  }
  function closeEdit() {
    $('opEditModal').classList.remove('active');
    $('opEditModal').style.display = 'none';
  }

  async function saveEdit() {
    const name    = $('editName').value.trim();
    const phone   = $('editPhone').value.trim();
    const orgName = $('editOrgName').value.trim();
    const city    = $('editCity').value.trim();
    const err = msg => { $('opEditError').textContent = msg; };

    if (!name) return err('Enter your name.');
    if (phone && !/^[\d\s+\-]{8,15}$/.test(phone)) return err('Enter a valid phone number.');
    if (!window.sb || !session.userId) return err('Not connected. Refresh the page and try again.');

    const btn = $('opSaveBtn');
    btn.disabled = true;
    try {
      const { error: pErr } = await window.sb.from('profiles').update({ full_name: name, phone }).eq('id', session.userId);
      if (pErr) return err('Could not save your details: ' + pErr.message);

      if (org && orgName) {
        const { error: oErr } = await window.sb.from('organizers')
          .update({ org_name: orgName, city, contact_person: name, phone_number: phone })
          .eq('organizer_id', org.organizer_id);
        if (oErr) return err('Could not save the organization: ' + oErr.message);
        Object.assign(org, { org_name: orgName, city, contact_person: name, phone_number: phone });
      } else if (!org && orgName) {
        // A new organization waits for the super admin to verify it
        const { data: newOrg, error: oErr } = await window.sb.from('organizers').insert({
          owner_id: session.userId, org_name: orgName, city: city || null,
          contact_person: name, phone_number: phone || null, status: 'PENDING_VERIFICATION',
        }).select('*').maybeSingle();
        if (oErr) return err('Could not add the organization: ' + oErr.message);
        org = newOrg;
      }

      // Keep the stored session's name in step
      try {
        const key = 'swimfest_session';
        const store = localStorage.getItem(key) ? localStorage : sessionStorage;
        const raw = store.getItem(key);
        if (raw) { const s = JSON.parse(raw); s.name = name; s.phone = phone; store.setItem(key, JSON.stringify(s)); session = s; }
      } catch (_) { session.name = name; }

      closeEdit();
      renderName();
      renderDetails();
      renderOrg();
    } finally {
      btn.disabled = false;
    }
  }

  function setNavOpen(open) {
    $('acShell').classList.toggle('nav-open', open);
    $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    $('opEditBtn').addEventListener('click', openEdit);
    $('opModalClose').addEventListener('click', closeEdit);
    $('opCancelBtn').addEventListener('click', closeEdit);
    $('opSaveBtn').addEventListener('click', saveEdit);
    $('opEditModal').addEventListener('click', (e) => { if (e.target === $('opEditModal')) closeEdit(); });
    $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
    $('acScrim').addEventListener('click', () => setNavOpen(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { setNavOpen(false); closeEdit(); } });
  });
})();
