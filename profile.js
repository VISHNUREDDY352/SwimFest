/* ============================================================
   SwimFest — Swimmer Profile   profile.js
   ============================================================ */
'use strict';

const $ = id => document.getElementById(id);
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Age category derivation ───────────────────────────────────
const MEET_YEAR = 2026;
const PF_CATEGORIES = [
  { label:'U-10', minAge:8,  maxAge:9  },
  { label:'U-12', minAge:10, maxAge:11 },
  { label:'U-14', minAge:12, maxAge:13 },
  { label:'U-16', minAge:14, maxAge:15 },
];
function pfDeriveCategory(dob) {
  if (!dob) return null;
  const age = MEET_YEAR - new Date(dob).getFullYear();
  const c = PF_CATEGORIES.find(x => age >= x.minAge && age <= x.maxAge);
  return c ? { label:c.label, age } : null;
}
let editGender = 'Boy';

// ── Live profile object — starts empty, filled from the account ──
const PROFILE = {
  name       : '',
  swimmerId  : '—',
  gender     : '—',
  dob        : '',
  category   : '—',
  academy    : '',
  coach      : '',
  parentName : '',
  parentPhone: '',
  parentEmail: '',
  serialNo   : '',
  city       : 'Tamil Nadu',
  state      : 'Tamil Nadu',
  stats      : { events:0, medals:0, pb:0, tournaments:0 },
};

// New accounts start with no history — populated from DB later.
let PERSONAL_BESTS = [];
let HISTORY        = [];
let REGISTRATIONS  = [];

// ── Render header ─────────────────────────────────────────────
function initials(name){
  const t = (name||'?').trim();
  if (!t) return '?';
  return t.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
}

// ── Load real account data (session + Supabase profile) ───────
async function loadAccount() {
  const s = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (!s) return;

  // From the login session
  PROFILE.name        = (s.name || '').replace(/\s*\(Parent\)$/i,'') || (s.email ? s.email.split('@')[0] : 'Swimmer');
  PROFILE.parentName  = PROFILE.name;
  PROFILE.parentEmail = s.email || '';
  PROFILE.parentPhone = s.phone || '';

  // Enrich from Supabase profiles table (if available + logged in via Supabase)
  if (window.sb && s.userId) {
    try {
      const { data: prof } = await window.sb
        .from('profiles').select('full_name, phone, role').eq('id', s.userId).single();
      if (prof) {
        if (prof.full_name) { PROFILE.name = prof.full_name; PROFILE.parentName = prof.full_name; }
        if (prof.phone)     PROFILE.parentPhone = prof.phone;
      }

      // If a swimmer record already exists for this account, load it
      const { data: sw } = await window.sb
        .from('swimmers').select('*').eq('owner_id', s.userId).limit(1).maybeSingle();
      if (sw) {
        PROFILE.swimmerId   = sw.swimmer_id ? sw.swimmer_id.slice(0,8).toUpperCase() : PROFILE.swimmerId;
        PROFILE.gender      = sw.gender || PROFILE.gender;
        PROFILE.dob         = sw.date_of_birth || PROFILE.dob;
        PROFILE.category    = sw.category ? `${sw.gender==='Girl'?'Girls':'Boys'} ${sw.category}` : PROFILE.category;
        PROFILE.serialNo    = sw.sfi_serial_no || PROFILE.serialNo;
        PROFILE.parentName  = sw.parent_name  || PROFILE.parentName;
        PROFILE.parentPhone = sw.parent_phone || PROFILE.parentPhone;
        PROFILE.parentEmail = sw.parent_email || PROFILE.parentEmail;
      }
    } catch (_) { /* table may be empty for a new user — fine */ }
  }
}

function renderHeader() {
  $('pfAvatar').textContent    = initials(PROFILE.name);
  $('pfName').textContent      = PROFILE.name;
  $('pfCategory').textContent  = PROFILE.category;
  $('pfSwimmerId').textContent = PROFILE.swimmerId;
  $('pfAcademy').textContent   = PROFILE.academy || 'Unattached';
  $('statEvents').textContent      = PROFILE.stats.events;
  $('statMedals').textContent      = PROFILE.stats.medals;
  $('statPB').textContent          = PROFILE.stats.pb;
  $('statTournaments').textContent = PROFILE.stats.tournaments;
}

// ── Render Personal Bests ─────────────────────────────────────
function renderPBs() {
  if (!PERSONAL_BESTS.length) {
    $('pbGrid').innerHTML = `<div style="grid-column:1/-1;padding:28px;text-align:center;color:var(--gray);font-size:0.85rem;">
      <i class="fas fa-stopwatch" style="font-size:1.6rem;display:block;margin-bottom:8px;color:var(--gray-light);"></i>
      No personal best times yet. Compete in an event to set your first record!</div>`;
    return;
  }
  $('pbGrid').innerHTML = PERSONAL_BESTS.map(pb => `
    <div class="pf-pb-item">
      <div class="pf-pb-event">${escHtml(pb.event)}</div>
      <div class="pf-pb-time">${escHtml(pb.time)}</div>
      <div class="pf-pb-sub">
        <i class="fas fa-trophy" style="color:#b7791f;font-size:0.65rem;"></i> ${escHtml(pb.meet)}
        ${pb.improve ? `<span class="pb-improve"><i class="fas fa-arrow-down"></i> ${escHtml(pb.improve)}</span>` : ''}
      </div>
    </div>`).join('');
}

// ── Render History ────────────────────────────────────────────
function rankCell(rank){
  if (rank === null) return '<span style="color:var(--gray)">—</span>';
  const cls = rank===1?'rank-gold':rank===2?'rank-silver':rank===3?'rank-bronze':'';
  const medal = rank<=3 ? '<i class="fas fa-medal"></i>' : '';
  const ord = rank===1?'st':rank===2?'nd':rank===3?'rd':'th';
  return `<span class="pf-rank ${cls}">${medal} ${rank}${ord}</span>`;
}

function renderHistory(filter='') {
  const rows = HISTORY.filter(h => !filter || h.stroke === filter);
  const tbody = $('historyBody');
  if (rows.length === 0) {
    const msg = HISTORY.length === 0
      ? 'No event history yet. Register for a tournament to get started.'
      : 'No events match this filter.';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--gray);">${msg}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(h => {
    const isNT = h.time.toUpperCase()==='NT' || h.status!=='OK';
    const timeDisp = h.status==='OK' ? `<span class="pf-h-time">${escHtml(h.time)}</span>` : `<span class="pf-h-time nt">${h.status==='DNS'?'—':h.time}</span>`;
    const statusCls = `status-${h.status.toLowerCase()}`;
    return `<tr>
      <td class="pf-h-event">${escHtml(h.event)}</td>
      <td style="color:var(--gray);font-size:0.78rem;">${escHtml(h.tournament)}</td>
      <td>${timeDisp}</td>
      <td>${rankCell(h.rank)}</td>
      <td><span class="pf-status ${statusCls}">${escHtml(h.status)}</span></td>
    </tr>`;
  }).join('');
}

// ── Render Detail List ────────────────────────────────────────
function fmtDob(dob){ if(!dob) return 'Not set'; const [y,m,d]=dob.split('-'); return `${d}/${m}/${y}`; }

function renderDetails() {
  const age = PROFILE.dob ? (2026 - new Date(PROFILE.dob).getFullYear()) + ' yrs' : 'Not set';
  const rows = [
    { label:'Gender',        value:PROFILE.gender || 'Not set', locked:true },
    { label:'Date of Birth', value:fmtDob(PROFILE.dob), locked:true },
    { label:'Competition Age', value:age },
    { label:'Category',      value:PROFILE.category || 'Not set' },
    { label:'SFI Serial No.', value:PROFILE.serialNo || '—' },
    { label:'Parent / Guardian', value:PROFILE.parentName || '—' },
    { label:'Contact',       value:PROFILE.parentPhone || '—' },
    { label:'Email',         value:PROFILE.parentEmail || '—' },
    { label:'City / State',  value:`${PROFILE.city || '—'}, ${PROFILE.state}` },
  ];
  $('detailList').innerHTML = rows.map(r => `
    <div class="pf-detail-row">
      <span class="pf-detail-label">${escHtml(r.label)}${r.locked?'<span class="pf-locked-badge"><i class="fas fa-lock"></i></span>':''}</span>
      <span class="pf-detail-value">${escHtml(r.value)}</span>
    </div>`).join('');
}

// ── Render Registrations ──────────────────────────────────────
function renderRegistrations() {
  if (!REGISTRATIONS.length) {
    $('regList').innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray);font-size:0.85rem;">
      <i class="fas fa-clipboard-list" style="font-size:1.6rem;display:block;margin-bottom:8px;color:var(--gray-light);"></i>
      No registrations yet.
      <a href="register.html" style="display:inline-block;margin-top:10px;color:var(--primary);font-weight:600;">Register for an event →</a></div>`;
    return;
  }
  const statusCls = { CONFIRMED:'reg-confirmed', UPCOMING:'reg-upcoming', COMPLETED:'reg-completed' };
  $('regList').innerHTML = REGISTRATIONS.map(r => `
    <div class="pf-reg-item">
      <div class="pf-reg-icon" style="background:${r.color};"><i class="fas fa-${r.icon}"></i></div>
      <div class="pf-reg-info">
        <div class="pf-reg-name">${escHtml(r.name)}</div>
        <div class="pf-reg-date"><i class="fas fa-calendar-alt"></i> ${escHtml(r.date)}</div>
      </div>
      <span class="pf-reg-status ${statusCls[r.status]}">${escHtml(r.status)}</span>
    </div>`).join('');
}

// ── Render Academy Card ───────────────────────────────────────
function renderAcademy() {
  const card = $('academyCard');
  if (!PROFILE.academy) {
    card.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray);font-size:0.85rem;">
      <i class="fas fa-building" style="font-size:1.6rem;display:block;margin-bottom:8px;color:var(--gray-light);"></i>
      Not affiliated with any academy.</div>`;
    return;
  }
  const initials2 = PROFILE.academy.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  card.innerHTML = `
    <div class="pf-academy-logo">${initials2}</div>
    <div class="pf-academy-name">${escHtml(PROFILE.academy)}</div>
    <div class="pf-academy-loc"><i class="fas fa-map-marker-alt"></i> ${escHtml(PROFILE.city)}, ${escHtml(PROFILE.state)}</div>
    ${PROFILE.coach ? `<div class="pf-academy-coach">Coach: <strong>${escHtml(PROFILE.coach)}</strong></div>` : ''}
    <a href="academy.html" class="pf-btn pf-btn-outline" style="width:100%;justify-content:center;">
      <i class="fas fa-external-link-alt"></i> View Academy Profile
    </a>`;
}

// ── Populate edit academy dropdown ────────────────────────────
let ACADEMY_LIST = [];  // loaded from Supabase

async function populateEditAcademy() {
  const sel = $('editAcademy');
  if (!sel) return;
  // Load academies from Supabase once
  if (ACADEMY_LIST.length === 0 && window.sb) {
    try {
      const { data } = await window.sb
        .from('academies').select('academy_name, city').eq('status','APPROVED_ACTIVE').order('academy_name');
      if (data) ACADEMY_LIST = data;
    } catch (_) {}
  }
  sel.innerHTML = '<option value="">None / Unattached</option>' +
    ACADEMY_LIST.map(a=>`<option value="${escHtml(a.academy_name)}" ${a.academy_name===PROFILE.academy?'selected':''}>${escHtml(a.academy_name)}</option>`).join('');
}

// ── Edit modal ────────────────────────────────────────────────
window.closeEdit = function(){ const m=$('editModal'); m.classList.remove('active'); m.style.display='none'; };

window.saveProfile = async function(){
  const dob = $('editDob').value;
  const cat = pfDeriveCategory(dob);

  if (dob && !cat) { showToast('Age must be within U-10 to U-16.','warn'); return; }

  PROFILE.name        = $('editName').value.trim() || PROFILE.name;
  PROFILE.gender      = editGender;
  PROFILE.dob         = dob || PROFILE.dob;
  PROFILE.category    = cat ? `${editGender==='Girl'?'Girls':'Boys'} ${cat.label}` : PROFILE.category;
  PROFILE.parentPhone = $('editPhone').value.trim();
  PROFILE.parentEmail = $('editEmail').value.trim();
  PROFILE.serialNo    = $('editSerial').value.trim();
  PROFILE.parentName  = PROFILE.name;
  PROFILE.academy     = $('editAcademy').value;

  const ac = ACADEMY_LIST.find(a=>a.academy_name===PROFILE.academy);
  if (ac) { PROFILE.city = ac.city || PROFILE.city; }
  PROFILE.coach = '';

  // Persist to Supabase (create swimmer row if none exists)
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  const userId  = session ? session.userId : null;
  if (window.sb && userId) {
    try {
      let academyId = ac ? await getAcademyId(PROFILE.academy) : null;
      const payload = {
        owner_id: userId, full_name: PROFILE.name, gender: PROFILE.gender,
        date_of_birth: PROFILE.dob || null, category: cat ? cat.label : null,
        sfi_serial_no: PROFILE.serialNo || null, parent_name: PROFILE.name,
        parent_phone: PROFILE.parentPhone, parent_email: PROFILE.parentEmail,
        academy_id: academyId,
      };
      // Does a swimmer row already exist for this account?
      const { data: existing } = await window.sb.from('swimmers')
        .select('swimmer_id').eq('owner_id', userId).limit(1).maybeSingle();
      if (existing) {
        await window.sb.from('swimmers').update(payload).eq('swimmer_id', existing.swimmer_id);
      } else {
        await window.sb.from('swimmers').insert(payload);
      }
      // Also keep the profile name/phone in sync
      await window.sb.from('profiles').update({ full_name: PROFILE.name, phone: PROFILE.parentPhone }).eq('id', userId);
    } catch (e) { console.error('[SwimFest] profile save error:', e.message); showToast('Saved locally, but DB update failed.','warn'); }
  }

  closeEdit();
  renderHeader(); renderDetails(); renderAcademy();
  showToast('Profile updated successfully.','success');
};

async function getAcademyId(name) {
  if (!window.sb || !name) return null;
  try {
    const { data } = await window.sb.from('academies').select('academy_id').eq('academy_name', name).maybeSingle();
    return data ? data.academy_id : null;
  } catch (_) { return null; }
}

// ── Edit modal: gender toggle + DOB derive + open ─────────────
function initEditExtras() {
  document.querySelectorAll('.pf-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pf-gender-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      editGender = btn.dataset.gender;
      updateEditDerived();
    });
  });
  const dobEl = $('editDob');
  if (dobEl) {
    dobEl.max = `${MEET_YEAR - 8}-12-31`;
    dobEl.addEventListener('change', updateEditDerived);
  }
}

function updateEditDerived() {
  const dob = $('editDob').value;
  const box = $('editDerived');
  if (!dob) { box.style.display='none'; return; }
  const cat = pfDeriveCategory(dob);
  if (!cat) { box.style.display=''; box.innerHTML = `<span class="pd-pill err"><i class="fas fa-exclamation-triangle"></i> Not U-10 to U-16</span>`; return; }
  box.style.display='';
  box.innerHTML = `<span class="pd-pill"><i class="fas fa-birthday-cake"></i> Age ${cat.age}</span>
    <span class="pd-pill cat">${editGender==='Girl'?'Girls':'Boys'} ${cat.label}</span>`;
}

// ── Logout ────────────────────────────────────────────────────
function initLogout() {
  $('logoutBtn').addEventListener('click', () => {
    if (window.SwimAuth) window.SwimAuth.logout();
    showToast('Signed out. Redirecting…','info');
    setTimeout(()=>{ window.location.href='index.html'; }, 800);
  });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type='info') {
  const e = document.querySelector('.admin-toast'); if(e) e.remove();
  const t = document.createElement('div');
  t.className = `admin-toast admin-toast-${type}`;
  const icon = type==='success'?'check-circle':type==='warn'?'exclamation-triangle':'info-circle';
  t.innerHTML = `<i class="fas fa-${icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},3000);
}

(function(){
  const s=document.createElement('style');
  s.textContent=`
    .admin-toast{position:fixed;bottom:28px;right:28px;z-index:99999;padding:12px 20px;
      background:var(--dark);color:var(--white);border-radius:var(--radius-sm);font-size:0.85rem;
      font-weight:500;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);
      transform:translateY(20px);opacity:0;transition:all 0.3s ease;max-width:400px;font-family:'Inter',sans-serif;}
    .admin-toast.show{transform:translateY(0);opacity:1;}
    .admin-toast i{color:var(--accent);}
    .admin-toast.admin-toast-success i{color:var(--success);}`;
  document.head.appendChild(s);
})();

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard — must be logged in to view profile
  const session = window.SwimAuth && window.SwimAuth.requireLogin();
  if (!session) return;

  await loadAccount();   // pull real account data from session + Supabase

  renderHeader();
  renderPBs();
  renderHistory();
  renderDetails();
  renderRegistrations();
  renderAcademy();
  populateEditAcademy();
  initLogout();
  initEditExtras();

  $('editProfileBtn').addEventListener('click', () => {
    $('editName').value   = PROFILE.name;
    $('editPhone').value  = PROFILE.parentPhone;
    $('editEmail').value  = PROFILE.parentEmail;
    $('editSerial').value = PROFILE.serialNo && PROFILE.serialNo !== '—' ? PROFILE.serialNo : '';
    $('editDob').value    = PROFILE.dob || '';

    // Set gender toggle to current gender (default Boy)
    editGender = (PROFILE.gender === 'Girl') ? 'Girl' : 'Boy';
    document.querySelectorAll('.pf-gender-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.gender === editGender));

    updateEditDerived();
    populateEditAcademy();
    const m=$('editModal'); m.classList.add('active'); m.style.display='flex';
  });
  $('editModal').addEventListener('click', e => { if (e.target === $('editModal')) closeEdit(); });

  $('historyFilter').addEventListener('change', function(){ renderHistory(this.value); });

  // Mobile menu toggle
  const mBtn = $('mobileMenuBtn'), mMenu = $('mobileMenu');
  if (mBtn && mMenu) mBtn.addEventListener('click', () => mMenu.classList.toggle('active'));
});
