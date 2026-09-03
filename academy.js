/* ============================================================
   SwimFest — Academy & Coach Directory  (Chapter 6)
   academy.js
   ============================================================ */

'use strict';

// ─── Academy Master Data (Entity 1) ──────────────────────────
const ACADEMIES = [
  {
    academy_id   : 'ACD-TN-001',
    academy_name : 'Chennai Swim Club',
    address_line : '14, Velachery Main Road',
    city         : 'Chennai',
    state        : 'Tamil Nadu',
    contact_person: 'R. Sundaram',
    phone_number : '+91 98400 12345',
    email_id     : 'info@chennaiswim.com',
    pool_length  : '50m',
    lane_count   : '8_lanes',
    pool_type    : 'Indoor Heated Pool',
    status       : 'Active',
    initials     : 'CS',
    swimmers     : [
      { name:'Arun Kumar',    id:'SWM-2026-08492', category:'Boys U-12', events:3 },
      { name:'Priya Suresh',  id:'SWM-2026-08493', category:'Girls U-14', events:2 },
      { name:'Rahul Menon',   id:'SWM-2026-08494', category:'Boys U-16', events:3 },
      { name:'Sneha Ravi',    id:'SWM-2026-08495', category:'Girls U-12', events:1 },
    ],
  },
  {
    academy_id   : 'ACD-TN-002',
    academy_name : 'SRM Aquatics Academy',
    address_line : 'SRM University Campus, Kattankulathur',
    city         : 'Kattankulathur',
    state        : 'Tamil Nadu',
    contact_person: 'Dr. M. Arumugam',
    phone_number : '+91 94440 67890',
    email_id     : 'sports@srm.edu',
    pool_length  : '50m',
    lane_count   : '8_lanes',
    pool_type    : 'Outdoor Competition Pool',
    status       : 'Active',
    initials     : 'SR',
    swimmers     : [
      { name:'Vikram Nair',    id:'SWM-2026-09001', category:'Boys U-14', events:3 },
      { name:'Ananya Pillai',  id:'SWM-2026-09002', category:'Girls U-16', events:2 },
    ],
  },
  {
    academy_id   : 'ACD-TN-003',
    academy_name : 'Aqua Stars Coimbatore',
    address_line : 'Race Course Road, Coimbatore',
    city         : 'Coimbatore',
    state        : 'Tamil Nadu',
    contact_person: 'P. Krishnamurthy',
    phone_number : '+91 97890 54321',
    email_id     : 'aquastars.cbe@gmail.com',
    pool_length  : '25m',
    lane_count   : '6_lanes',
    pool_type    : 'Indoor Pool',
    status       : 'Active',
    initials     : 'AQ',
    swimmers     : [
      { name:'Karthik Raja',  id:'SWM-2026-09201', category:'Boys U-10', events:2 },
      { name:'Divya Mohan',   id:'SWM-2026-09202', category:'Girls U-12', events:3 },
      { name:'Arjun Selvam',  id:'SWM-2026-09203', category:'Boys U-12', events:1 },
    ],
  },
  {
    academy_id   : 'ACD-TN-004',
    academy_name : 'SDAT Academy Chennai',
    address_line : 'SDAT Aquatic Complex, Velachery',
    city         : 'Chennai',
    state        : 'Tamil Nadu',
    contact_person: 'S. Balakrishnan',
    phone_number : '+91 94450 11223',
    email_id     : 'sdat.aquatics@tn.gov.in',
    pool_length  : '50m',
    lane_count   : '8_lanes',
    pool_type    : 'Olympic Standard Pool',
    status       : 'Active',
    initials     : 'SD',
    swimmers     : [
      { name:'Meera Shankar',  id:'SWM-2026-09401', category:'Girls U-16', events:3 },
      { name:'Surya Prakash',  id:'SWM-2026-09402', category:'Boys U-16', events:2 },
      { name:'Lakshmi Rao',    id:'SWM-2026-09403', category:'Girls U-14', events:3 },
    ],
  },
  {
    academy_id   : 'ACD-TN-005',
    academy_name : 'Madurai Aquatics',
    address_line : 'Near Periyar Bus Stand, Madurai',
    city         : 'Madurai',
    state        : 'Tamil Nadu',
    contact_person: 'T. Ragunathan',
    phone_number : '+91 93456 78901',
    email_id     : 'madurai.aquatics@gmail.com',
    pool_length  : '25m',
    lane_count   : '6_lanes',
    pool_type    : 'Outdoor Pool',
    status       : 'Active',
    initials     : 'MA',
    swimmers     : [
      { name:'Raj Pandian', id:'SWM-2026-09501', category:'Boys U-14', events:2 },
    ],
  },
  {
    academy_id   : 'ACD-TN-006',
    academy_name : 'Trichy Swim Academy',
    address_line : 'Woraiyur, Tiruchirappalli',
    city         : 'Trichy',
    state        : 'Tamil Nadu',
    contact_person: 'N. Mohanraj',
    phone_number : '+91 98765 43211',
    email_id     : 'trichyswim@gmail.com',
    pool_length  : '25m',
    lane_count   : '6_lanes',
    pool_type    : 'Community Pool',
    status       : 'Inactive',
    initials     : 'TS',
    swimmers     : [],
  },
];

// ─── Coach Master Data (Entity 2) ─────────────────────────────
const COACHES = [
  {
    coach_id        : 'CCH-TN-101',
    full_name       : 'K. Ramesh',
    gender          : 'Male',
    date_of_birth   : '1982-06-14',
    mobile_number   : '+91 98400 11111',
    email_id        : 'k.ramesh@chennaiswim.com',
    academy_id      : 'ACD-TN-001',
    designation     : 'Head Coach',
    certifications  : ['ASCA Level 3', 'SFI Certified'],
    experience_years: 12,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-102',
    full_name       : 'S. Priya',
    gender          : 'Female',
    date_of_birth   : '1990-03-22',
    mobile_number   : '+91 98400 22222',
    email_id        : 's.priya@chennaiswim.com',
    academy_id      : 'ACD-TN-001',
    designation     : 'Assistant Coach',
    certifications  : ['NIS Diploma', 'World Aquatics Cert'],
    experience_years: 7,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-103',
    full_name       : 'V. Anand',
    gender          : 'Male',
    date_of_birth   : '1978-11-05',
    mobile_number   : '+91 94440 33333',
    email_id        : 'v.anand@srm.edu',
    academy_id      : 'ACD-TN-002',
    designation     : 'Head Coach',
    certifications  : ['ASCA Level 4', 'NIS Diploma'],
    experience_years: 18,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-104',
    full_name       : 'M. Vijay',
    gender          : 'Male',
    date_of_birth   : '1985-09-17',
    mobile_number   : '+91 97890 44444',
    email_id        : 'mvijay@aquastars.com',
    academy_id      : 'ACD-TN-003',
    designation     : 'Head Coach',
    certifications  : ['ASCA Level 2', 'First Aid/CPR'],
    experience_years: 10,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-105',
    full_name       : 'R. Kavitha',
    gender          : 'Female',
    date_of_birth   : '1993-01-30',
    mobile_number   : '+91 97890 55555',
    email_id        : 'kavitha@aquastars.com',
    academy_id      : 'ACD-TN-003',
    designation     : 'Assistant Coach',
    certifications  : ['SFI Certified', 'First Aid/CPR'],
    experience_years: 4,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-106',
    full_name       : 'A. Selvakumar',
    gender          : 'Male',
    date_of_birth   : '1975-07-08',
    mobile_number   : '+91 94450 66666',
    email_id        : 'selva@sdat.gov.in',
    academy_id      : 'ACD-TN-004',
    designation     : 'Head Coach',
    certifications  : ['ASCA Level 5', 'NIS Diploma', 'World Aquatics Cert'],
    experience_years: 22,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-107',
    full_name       : 'P. Dhanalakshmi',
    gender          : 'Female',
    date_of_birth   : '1988-04-12',
    mobile_number   : '+91 94450 77777',
    email_id        : 'dhana@sdat.gov.in',
    academy_id      : 'ACD-TN-004',
    designation     : 'Fitness/Performance Coach',
    certifications  : ['ASCA Level 2', 'First Aid/CPR'],
    experience_years: 9,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-108',
    full_name       : 'S. Murugan',
    gender          : 'Male',
    date_of_birth   : '1980-12-25',
    mobile_number   : '+91 93456 88888',
    email_id        : 'murugan@madurai.com',
    academy_id      : 'ACD-TN-005',
    designation     : 'Head Coach',
    certifications  : ['SFI Certified', 'NIS Diploma'],
    experience_years: 15,
    status          : 'Active',
  },
  {
    coach_id        : 'CCH-TN-109',
    full_name       : 'N. Mohanraj',
    gender          : 'Male',
    date_of_birth   : '1983-08-18',
    mobile_number   : '+91 98765 99999',
    email_id        : 'mohanraj@trichyswim.com',
    academy_id      : 'ACD-TN-006',
    designation     : 'Head Coach',
    certifications  : ['ASCA Level 1'],
    experience_years: 8,
    status          : 'Inactive',
  },
];

// ─── Helper: get coaches for an academy ───────────────────────
function getCoachesForAcademy(academyId) {
  return COACHES.filter(c => c.academy_id === academyId);
}

// ─── Expose for register.js dynamic filtering (Rule 6.2) ─────
window.SWIMFEST_ACADEMIES = ACADEMIES;
window.SWIMFEST_COACHES   = COACHES;
window.getCoachesForAcademy = getCoachesForAcademy;

// ─── DOM helpers ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initials(name) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

function laneLabel(l) {
  return l === '8_lanes' ? '8 Lanes' : '6 Lanes';
}

function designationClass(d) {
  return d === 'Head Coach' ? 'head' : '';
}

// ─── Render hero stats ────────────────────────────────────────
function renderHeroStats() {
  const active   = ACADEMIES.filter(a => a.status === 'Active').length;
  const total    = ACADEMIES.length;
  const coaches  = COACHES.filter(c => c.status === 'Active').length;
  const swimmers = ACADEMIES.reduce((s, a) => s + a.swimmers.length, 0);

  $('heroStats').innerHTML = `
    <div class="acd-stat-pill">
      <div class="acd-stat-num">${active}<span>+</span></div>
      <div class="acd-stat-label">Active Academies</div>
    </div>
    <div class="acd-stat-pill">
      <div class="acd-stat-num">${coaches}<span>+</span></div>
      <div class="acd-stat-label">Certified Coaches</div>
    </div>
    <div class="acd-stat-pill">
      <div class="acd-stat-num">${swimmers}<span>+</span></div>
      <div class="acd-stat-label">Registered Swimmers</div>
    </div>
    <div class="acd-stat-pill">
      <div class="acd-stat-num">${total}</div>
      <div class="acd-stat-label">Total Academies</div>
    </div>`;
}

// ─── Render Academy Card ──────────────────────────────────────
function renderCard(ac) {
  const coaches  = getCoachesForAcademy(ac.academy_id);
  const isActive = ac.status === 'Active';

  const coachRows = coaches.map(c => `
    <div class="acd-coach-row">
      <div class="acd-coach-avatar ${c.designation === 'Head Coach' ? 'acd-coach-head-avatar' : ''}">
        ${initials(c.full_name)}
      </div>
      <div class="acd-coach-info">
        <div class="acd-coach-name">
          ${escHtml(c.full_name)}
          <span class="acd-coach-designation ${designationClass(c.designation)}">${escHtml(c.designation)}</span>
        </div>
        <div class="acd-coach-certs">
          ${c.certifications.map(cert => `<span class="cert-tag">${escHtml(cert)}</span>`).join('')}
        </div>
        <div class="acd-coach-exp"><i class="fas fa-clock"></i> ${c.experience_years} yrs experience &nbsp;·&nbsp; ID: ${c.coach_id}</div>
      </div>
    </div>`).join('');

  const card = document.createElement('div');
  card.className = `acd-card${!isActive ? ' inactive-card' : ''}`;
  card.dataset.academyId = ac.academy_id;

  card.innerHTML = `
    <div class="acd-card-stripe"></div>
    <div class="acd-card-header">
      <div class="acd-avatar${!isActive ? ' acd-avatar-inactive' : ''}">${escHtml(ac.initials)}</div>
      <div class="acd-card-title-block">
        <div class="acd-card-name">${escHtml(ac.academy_name)}</div>
        <div class="acd-card-id">${ac.academy_id}</div>
      </div>
      <span class="acd-status-badge ${isActive ? 'status-active' : 'status-inactive'}">
        ${ac.status}
      </span>
    </div>
    <div class="acd-card-body">
      <div class="acd-info-row">
        <i class="fas fa-map-marker-alt"></i>
        <span>${escHtml(ac.address_line)}, ${escHtml(ac.city)}, ${escHtml(ac.state)}</span>
      </div>
      <div class="acd-info-row">
        <i class="fas fa-user-tie"></i>
        <span><strong>Contact:</strong> ${escHtml(ac.contact_person)}</span>
      </div>
      <div class="acd-info-row">
        <i class="fas fa-phone"></i>
        <span>${escHtml(ac.phone_number)} &nbsp;·&nbsp; <a href="mailto:${escHtml(ac.email_id)}" style="color:var(--primary)">${escHtml(ac.email_id)}</a></span>
      </div>
      <div class="acd-info-row">
        <i class="fas fa-swimming-pool"></i>
        <div>
          <strong>Pool Specs:</strong>
          <div class="pool-specs" style="margin-top:4px;">
            <span class="pool-pill"><i class="fas fa-ruler-horizontal"></i> ${ac.pool_length} Olympic Pool</span>
            <span class="pool-pill"><i class="fas fa-grip-lines-vertical"></i> ${laneLabel(ac.lane_count)}</span>
            <span class="pool-pill"><i class="fas fa-water"></i> ${escHtml(ac.pool_type)}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="acd-coaches-block">
      <div class="acd-coaches-label"><i class="fas fa-chalkboard-teacher"></i> Affiliated Coaches (${coaches.length})</div>
      ${coachRows || '<div style="font-size:0.82rem;color:var(--gray);padding:4px 0 8px;">No coaches linked.</div>'}
    </div>
    <div class="acd-card-actions">
      <button class="acd-btn acd-btn-primary" data-action="profile" data-id="${ac.academy_id}">
        <i class="fas fa-id-card"></i> View Academy Profile
      </button>
      <button class="acd-btn acd-btn-ghost" data-action="swimmers" data-id="${ac.academy_id}">
        <i class="fas fa-users"></i> Associated Swimmers (${ac.swimmers.length})
      </button>
    </div>`;

  // Button handlers
  card.querySelector('[data-action="profile"]').addEventListener('click', () => openProfileModal(ac.academy_id));
  card.querySelector('[data-action="swimmers"]').addEventListener('click', () => openSwimmersModal(ac.academy_id));

  return card;
}

// ─── Render Grid ──────────────────────────────────────────────
function renderGrid(list) {
  const grid = $('acdGrid');
  grid.innerHTML = '';

  if (list.length === 0) {
    $('acdEmpty').style.display = '';
    $('acdResultsCount').textContent = 'No academies found';
    return;
  }

  $('acdEmpty').style.display = 'none';
  $('acdResultsCount').textContent = `Showing ${list.length} ${list.length === 1 ? 'academy' : 'academies'}`;
  list.forEach(ac => grid.appendChild(renderCard(ac)));
}

// ─── Filter Logic ─────────────────────────────────────────────
function applyFilters() {
  const q      = $('acdSearch').value.trim().toLowerCase();
  const city   = $('cityFilter').value;
  const pool   = $('poolFilter').value;
  const status = $('statusFilter').value;

  // show/hide clear button
  $('acdSearchClear').style.display = q ? '' : 'none';

  const result = ACADEMIES.filter(ac => {
    const coaches = getCoachesForAcademy(ac.academy_id);
    const matchQ  = !q
      || ac.academy_name.toLowerCase().includes(q)
      || ac.city.toLowerCase().includes(q)
      || coaches.some(c => c.full_name.toLowerCase().includes(q));
    const matchCity   = !city   || ac.city === city;
    const matchPool   = !pool   || ac.pool_length === pool;
    const matchStatus = !status || ac.status === status;
    return matchQ && matchCity && matchPool && matchStatus;
  });

  renderGrid(result);
}

// ─── Populate city filter dropdown ───────────────────────────
function populateCityFilter() {
  const cities = [...new Set(ACADEMIES.map(a => a.city))].sort();
  const sel    = $('cityFilter');
  cities.forEach(city => {
    const opt  = document.createElement('option');
    opt.value  = city;
    opt.textContent = city;
    sel.appendChild(opt);
  });
}

// ─── Academy Profile Modal ────────────────────────────────────
function openProfileModal(academyId) {
  const ac      = ACADEMIES.find(a => a.academy_id === academyId);
  const coaches = getCoachesForAcademy(academyId);
  if (!ac) return;

  $('modalAcademyName').textContent = ac.academy_name;

  const coachRows = coaches.map(c => `
    <div class="acd-modal-coach-row">
      <div class="acd-coach-avatar ${c.designation === 'Head Coach' ? 'acd-coach-head-avatar' : ''}">
        ${initials(c.full_name)}
      </div>
      <div class="acd-coach-info">
        <div class="acd-coach-name">
          ${escHtml(c.full_name)}
          <span class="acd-coach-designation ${designationClass(c.designation)}">${escHtml(c.designation)}</span>
        </div>
        <div class="acd-coach-certs">
          ${c.certifications.map(cert => `<span class="cert-tag">${escHtml(cert)}</span>`).join('')}
        </div>
        <div class="acd-coach-exp">
          <i class="fas fa-clock"></i> ${c.experience_years} yrs &nbsp;·&nbsp;
          <i class="fas fa-phone"></i> ${escHtml(c.mobile_number)} &nbsp;·&nbsp;
          <i class="fas fa-envelope"></i> ${escHtml(c.email_id)}
        </div>
      </div>
    </div>`).join('');

  $('acdModalBody').innerHTML = `
    <div class="acd-modal-section">
      <div class="acd-modal-section-label">Academy Details</div>
      <div class="acd-modal-info-grid">
        <div>
          <div class="acd-modal-field-label">Academy ID</div>
          <div class="acd-modal-field-value" style="font-family:monospace">${ac.academy_id}</div>
        </div>
        <div>
          <div class="acd-modal-field-label">Status</div>
          <div class="acd-modal-field-value">
            <span class="acd-status-badge ${ac.status === 'Active' ? 'status-active' : 'status-inactive'}">${ac.status}</span>
          </div>
        </div>
        <div>
          <div class="acd-modal-field-label">Address</div>
          <div class="acd-modal-field-value">${escHtml(ac.address_line)}</div>
        </div>
        <div>
          <div class="acd-modal-field-label">City / State</div>
          <div class="acd-modal-field-value">${escHtml(ac.city)}, ${escHtml(ac.state)}</div>
        </div>
        <div>
          <div class="acd-modal-field-label">Contact Person</div>
          <div class="acd-modal-field-value">${escHtml(ac.contact_person)}</div>
        </div>
        <div>
          <div class="acd-modal-field-label">Phone</div>
          <div class="acd-modal-field-value">${escHtml(ac.phone_number)}</div>
        </div>
        <div>
          <div class="acd-modal-field-label">Email</div>
          <div class="acd-modal-field-value">${escHtml(ac.email_id)}</div>
        </div>
        <div>
          <div class="acd-modal-field-label">Pool</div>
          <div class="acd-modal-field-value">${ac.pool_length} · ${laneLabel(ac.lane_count)} · ${escHtml(ac.pool_type)}</div>
        </div>
      </div>
    </div>
    <div class="acd-modal-section">
      <div class="acd-modal-section-label">Affiliated Coaches (${coaches.length})</div>
      ${coachRows || '<p style="color:var(--gray);font-size:0.85rem;">No coaches linked to this academy.</p>'}
    </div>`;

  openModal('acdProfileModal');
}

// ─── Associated Swimmers Modal ────────────────────────────────
function openSwimmersModal(academyId) {
  const ac = ACADEMIES.find(a => a.academy_id === academyId);
  if (!ac) return;

  $('modalSwimmersTitle').textContent = `${ac.academy_name} — Swimmers`;

  if (ac.swimmers.length === 0) {
    $('swimmersModalBody').innerHTML = `
      <div style="padding:32px;text-align:center;color:var(--gray);">
        <i class="fas fa-users" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
        No swimmers registered under this academy yet.
      </div>`;
  } else {
    $('swimmersModalBody').innerHTML = `
      <table class="swimmers-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Swimmer Name</th>
            <th>Swimmer ID</th>
            <th>Category</th>
            <th>Events</th>
          </tr>
        </thead>
        <tbody>
          ${ac.swimmers.map((sw, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${escHtml(sw.name)}</strong></td>
              <td style="font-family:monospace;font-size:0.78rem;">${escHtml(sw.id)}</td>
              <td><span class="swimmer-cat-pill">${escHtml(sw.category)}</span></td>
              <td>${sw.events}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  openModal('acdSwimmersModal');
}

// ─── Modal helpers ────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('active');
  m.style.display = 'flex';
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('active');
  m.style.display = 'none';
}

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHeroStats();
  populateCityFilter();
  renderGrid(ACADEMIES);
  $('acdResultsCount').textContent = `Showing ${ACADEMIES.length} academies`;

  // Search
  $('acdSearch').addEventListener('input', applyFilters);
  $('acdSearchClear').addEventListener('click', () => {
    $('acdSearch').value = '';
    applyFilters();
  });

  // Filters
  $('cityFilter').addEventListener('change', applyFilters);
  $('poolFilter').addEventListener('change', applyFilters);
  $('statusFilter').addEventListener('change', applyFilters);

  // Clear all
  $('acdClearAll').addEventListener('click', () => {
    $('acdSearch').value  = '';
    $('cityFilter').value = '';
    $('poolFilter').value = '';
    $('statusFilter').value = '';
    applyFilters();
  });

  // Modal closes
  $('acdModalClose').addEventListener('click',      () => closeModal('acdProfileModal'));
  $('swimmersModalClose').addEventListener('click', () => closeModal('acdSwimmersModal'));
  $('acdProfileModal').addEventListener('click',    e => { if (e.target === $('acdProfileModal')) closeModal('acdProfileModal'); });
  $('acdSwimmersModal').addEventListener('click',   e => { if (e.target === $('acdSwimmersModal')) closeModal('acdSwimmersModal'); });

  // Mobile menu (reuse existing pattern)
  const mobileBtn  = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => mobileMenu.classList.toggle('active'));
  }
});
