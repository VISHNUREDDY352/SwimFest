/* ============================================================
   SwimFest — Academy & Coach Directory  (Chapter 6)
   academy.js
   ============================================================ */

'use strict';

// ─── Academy Master Data (Entity 1) — replaced from Supabase ──
let ACADEMIES = [];

// ─── Coach Master Data (Entity 2) — replaced from Supabase ────
let COACHES = [];

// ─── Swimmers (public directory view) — names shown to staff only ─
let SWIMMERS = [];

// ─── Which directory is showing: academies | coaches | swimmers ─
const TABS = ['academies', 'coaches', 'swimmers'];
let TAB = 'academies';

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
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function laneLabel(l) {
  const n = parseInt(l, 10);
  return n ? `${n} lanes` : 'Lanes not listed';
}

function poolLabel(len) {
  return len && len !== '—' ? `${String(len).replace(/m$/, ' m')} pool` : 'Pool length not listed';
}

// Staff see the swimmer lists; the public only sees how many swimmers an academy has
function isStaffViewer() {
  const s = window.SwimAuth ? window.SwimAuth.getSession() : null;
  return !!(s && ['event_manager', 'super_admin'].includes(s.role));
}

function designationClass(d) {
  return d === 'Head Coach' ? 'head' : '';
}

// ─── Filters (city chip + pool length switch + search box) ───
const FILTER = { city: '', pool: '' };

// The academy's head coach (or first coach) and how many others it has
function leadCoach(ac) {
  const list = getCoachesForAcademy(ac.academy_id);
  const lead = list.find(c => c.designation === 'Head Coach') || list[0] || null;
  return { lead, others: Math.max(0, list.length - 1) };
}

// ─── Banner numbers ───────────────────────────────────────────
// The banner numbers and the side boxes follow the tab
function renderHeroStats() {
  const set = (i, label, value) => { $('g' + i + 'l').textContent = label; $('g' + i).textContent = value; };
  if (TAB === 'coaches') {
    const heads = COACHES.filter(c => c.designation === 'Head Coach').length;
    const years = COACHES.map(c => c.experience_years).filter(n => n > 0);
    set(1, 'Verified coaches', COACHES.length);
    set(2, 'Head coaches', heads);
    set(3, 'Other coaches', COACHES.length - heads);
    set(4, 'Average experience', years.length ? `${Math.round(years.reduce((a, b) => a + b, 0) / years.length)} yrs` : '—');
  } else if (TAB === 'swimmers') {
    set(1, 'Swimmers', SWIMMERS.length);
    set(2, 'Boys', SWIMMERS.filter(s => s.gender === 'Boy').length);
    set(3, 'Girls', SWIMMERS.filter(s => s.gender === 'Girl').length);
    set(4, 'In an academy', SWIMMERS.filter(s => s.academyName).length);
  } else {
    const ids = new Set(ACADEMIES.map(a => a.academy_id));
    set(1, 'Verified academies', ACADEMIES.length);
    set(2, 'Head coaches', COACHES.filter(c => ids.has(c.academy_id) && c.designation === 'Head Coach').length);
    set(3, '50 m pools', ACADEMIES.filter(a => a.pool_length === '50m').length);
    set(4, 'Cities', new Set(ACADEMIES.map(a => a.city).filter(Boolean)).size);
  }
}

const SIDE_COPY = {
  academies: {
    t1: 'What "verified" means', p1: "The SwimFest team checked the academy's registration, its pool and its head coach's certificates before listing it.",
    t2: 'Ready to race?', p2: 'Pick a meet and register your swimmer. Their academy appears on the entry and in the results.',
    cta: 'Register a swimmer', href: 'register.html',
  },
  coaches: {
    t1: 'About these coaches', p1: 'Only verified coaches are listed. Their certificates were checked by the SwimFest team; personal phone numbers stay private.',
    t2: 'Want to train with one?', p2: "Each coach's profile links to their academy, with its pool and contact details.",
    cta: 'Browse academies', href: '#academies',
  },
  swimmers: {
    t1: 'Swimmer privacy', p1: "Swimmers are children. Their names, races and results are only shown to SwimFest staff and to their own parents.",
    t2: 'Your swimmer', p2: "See your swimmer's races, results and registrations on your profile.",
    cta: 'Open my profile', href: 'profile.html',
  },
};

function renderSide() {
  const c = SIDE_COPY[TAB];
  $('side1Title').textContent = c.t1;
  $('side1Text').textContent = c.p1;
  $('side2Title').textContent = c.t2;
  $('side2Text').textContent = c.p2;
  $('side2Cta').textContent = c.cta;
  $('side2Cta').setAttribute('href', c.href);
}

function academyOf(id) { return ACADEMIES.find(a => a.academy_id === id) || null; }

function msToClock(ms) {
  if (ms == null || ms <= 0) return '';
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
  return `${min}:${sec}`;
}

// ─── City buttons, with how many academies each city has ──────
function renderCityChips() {
  // Coaches take their academy's city; independent coaches only show under "All cities"
  const items = TAB === 'coaches'
    ? COACHES.map(c => (academyOf(c.academy_id) || {}).city || '')
    : ACADEMIES.map(a => a.city);
  const counts = {};
  items.forEach(c => { if (c) counts[c] = (counts[c] || 0) + 1; });
  const cities = [...new Set(ACADEMIES.map(a => a.city).filter(Boolean))].sort();
  const chip = (value, label, n) =>
    `<button type="button" class="dir-chip" data-city="${escHtml(value)}" aria-pressed="${FILTER.city === value}">${escHtml(label)}<span>${n}</span></button>`;
  $('cityChips').innerHTML = chip('', 'All cities', items.length) + cities.map(c => chip(c, c, counts[c] || 0)).join('');
}

// ─── Academy card ─────────────────────────────────────────────
function renderCard(ac) {
  const { lead, others } = leadCoach(ac);
  const lanes = parseInt(ac.lane_count, 10) || 0;
  const length = ac.pool_length && ac.pool_length !== '—' ? String(ac.pool_length).replace(/m$/, ' m') : '';

  const coachLine = lead
    ? [lead.designation, lead.certifications[0], lead.experience_years ? `${lead.experience_years} yrs` : '', others ? `+${others} coach${others === 1 ? '' : 'es'}` : '']
        .filter(Boolean).map(escHtml).join(' · ')
    : 'The academy hasn’t added its coaches yet';

  const pool = lanes
    ? `<div class="dir-pool-lanes" role="img" aria-label="${escHtml(`${length || 'Pool'} with ${lanes} lanes`)}">
         ${Array.from({ length: lanes }, (_, i) => `<span>${i + 1}</span>`).join('')}
       </div>`
    : `<div class="dir-pool-none">Pool details not listed</div>`;

  const where = [ac.address_line, ac.address_line.includes(ac.city) ? '' : ac.city].filter(Boolean).join(', ');
  const swimmers = ac.swimmers.length;
  const card = document.createElement('article');
  card.className = 'dir-card';
  card.innerHTML = `
    <div class="dir-card-main">
      <div class="dir-card-top">
        <h3 class="dir-display">${escHtml(ac.academy_name)}</h3>
        <span class="dir-verified"><i class="fas fa-check" aria-hidden="true"></i> Verified</span>
      </div>
      <p class="dir-addr"><i class="fas fa-map-marker-alt" aria-hidden="true"></i><span>${escHtml(where || '—')}</span></p>
      <div class="dir-coach">
        <span class="dir-coach-avatar" aria-hidden="true">${lead ? escHtml(initials(lead.full_name.replace(/\./g, ' '))) : '—'}</span>
        <div style="min-width:0;">
          <div class="dir-coach-name">${lead ? escHtml(lead.full_name) : 'No coach listed yet'}</div>
          <div class="dir-coach-line">${coachLine}</div>
        </div>
      </div>
      <div class="dir-card-actions">
        <button type="button" class="dir-btn" data-action="profile">View academy</button>
        <button type="button" class="dir-btn dir-btn-ghost" data-action="swimmers">${swimmers} swimmer${swimmers === 1 ? '' : 's'}</button>
        <span class="dir-contact">${escHtml(ac.contact_person)} · <b>${escHtml(ac.phone_number)}</b></span>
      </div>
    </div>
    <figure class="dir-pool">
      ${pool}
      <figcaption><b>${escHtml([length, lanes ? `${lanes} lanes` : ''].filter(Boolean).join(' · ') || '—')}</b><span>${escHtml(ac.pool_type)}</span></figcaption>
    </figure>`;

  card.querySelector('[data-action="profile"]').addEventListener('click', () => openProfileModal(ac.academy_id));
  card.querySelector('[data-action="swimmers"]').addEventListener('click', () => openSwimmersModal(ac.academy_id));
  return card;
}

// ─── Render list ──────────────────────────────────────────────
function renderGrid(list) {
  const grid = $('acdGrid');
  grid.innerHTML = '';
  $('resultLine').textContent = list.length === 1 ? '1 academy' : `${list.length} academies`;
  $('acdEmpty').hidden = list.length > 0;
  list.forEach(ac => grid.appendChild(renderCard(ac)));
}

// ─── Coaches ──────────────────────────────────────────────────
function coachCard(c) {
  const ac = academyOf(c.academy_id);
  const card = document.createElement('article');
  card.className = 'dir-person';
  card.innerHTML = `
    <div class="dir-person-top">
      <span class="dir-person-avatar" aria-hidden="true">${escHtml(initials(c.full_name.replace(/\./g, ' ')))}</span>
      <div style="min-width:0;">
        <h3 class="dir-person-name dir-display">${escHtml(c.full_name)}</h3>
        <div class="dir-person-sub">${escHtml(c.designation)} · ${ac ? escHtml(ac.academy_name) : (c.academy_id ? 'Academy not verified yet' : 'Independent coach')}</div>
      </div>
    </div>
    <div class="dir-tags">
      ${c.certifications.slice(0, 3).map(t => `<span class="dir-tag">${escHtml(t)}</span>`).join('')}
      ${c.experience_years ? `<span class="dir-tag plain">${c.experience_years} yrs experience</span>` : ''}
      ${ac ? `<span class="dir-tag plain"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escHtml(ac.city)}</span>` : ''}
    </div>
    <button type="button" class="dir-btn dir-btn-ghost">View profile</button>`;
  card.querySelector('button').addEventListener('click', () => openCoachProfile(c.coach_id));
  return card;
}

function openCoachProfile(coachId) {
  const c = COACHES.find(x => x.coach_id === coachId);
  if (!c) return;
  const ac = academyOf(c.academy_id);
  $('personName').textContent = c.full_name;
  $('personBody').innerHTML = `
    <div class="acd-modal-section">
      <div class="acd-modal-section-label">Coach</div>
      <div class="acd-modal-info-grid">
        <div><div class="acd-modal-field-label">Role</div><div class="acd-modal-field-value">${escHtml(c.designation)}</div></div>
        <div><div class="acd-modal-field-label">Academy</div><div class="acd-modal-field-value">${ac ? `${escHtml(ac.academy_name)}, ${escHtml(ac.city)}` : (c.academy_id ? 'Academy not verified yet' : 'Independent coach')}</div></div>
        <div><div class="acd-modal-field-label">Experience</div><div class="acd-modal-field-value">${c.experience_years ? `${c.experience_years} years` : 'Not listed'}</div></div>
        <div><div class="acd-modal-field-label">Status</div><div class="acd-modal-field-value"><span class="acd-status-badge status-active">Verified</span></div></div>
      </div>
    </div>
    <div class="acd-modal-section">
      <div class="acd-modal-section-label">Certificates (${c.certifications.length})</div>
      ${c.certifications.length ? `<div class="dir-tags">${c.certifications.map(t => `<span class="dir-tag">${escHtml(t)}</span>`).join('')}</div>` : '<p style="color:var(--gray);font-size:0.85rem;margin:0;">No certificates listed.</p>'}
    </div>
    ${ac ? `<div class="acd-modal-section"><button type="button" class="dir-btn" id="personToAcademy">View ${escHtml(ac.academy_name)}</button></div>` : ''}`;
  const go = $('personToAcademy');
  if (go) go.addEventListener('click', () => { closeModal('personModal'); openProfileModal(ac.academy_id); });
  openModal('personModal');
}

// ─── Swimmers (staff only) ────────────────────────────────────
function swimmerCard(sw) {
  const card = document.createElement('article');
  card.className = 'dir-person';
  card.innerHTML = `
    <div class="dir-person-top">
      <span class="dir-person-avatar${sw.gender === 'Girl' ? ' girl' : ''}" aria-hidden="true">${escHtml(initials(sw.name))}</span>
      <div style="min-width:0;">
        <h3 class="dir-person-name dir-display">${escHtml(sw.name)}</h3>
        <div class="dir-person-sub">${escHtml([sw.category, sw.gender === 'Girl' ? 'Girls' : sw.gender === 'Boy' ? 'Boys' : ''].filter(Boolean).join(' · ') || 'Age group not set')}</div>
      </div>
    </div>
    <div class="dir-tags"><span class="dir-tag plain">${sw.academyName ? escHtml(sw.academyName) : 'No academy'}</span></div>
    <button type="button" class="dir-btn dir-btn-ghost">View profile</button>`;
  card.querySelector('button').addEventListener('click', () => openSwimmerProfile(sw.id));
  return card;
}

async function openSwimmerProfile(swimmerId) {
  const sw = SWIMMERS.find(x => x.id === swimmerId);
  if (!sw || !isStaffViewer()) return;
  $('personName').textContent = sw.name;
  const details = `
    <div class="acd-modal-section">
      <div class="acd-modal-section-label">Swimmer</div>
      <div class="acd-modal-info-grid">
        <div><div class="acd-modal-field-label">Age group</div><div class="acd-modal-field-value">${escHtml(sw.category || 'Not set')}</div></div>
        <div><div class="acd-modal-field-label">Gender</div><div class="acd-modal-field-value">${escHtml(sw.gender || '—')}</div></div>
        <div><div class="acd-modal-field-label">Academy</div><div class="acd-modal-field-value">${escHtml(sw.academyName || 'No academy')}</div></div>
      </div>
    </div>`;
  $('personBody').innerHTML = details + '<div class="acd-modal-section"><div class="acd-modal-section-label">Races</div><p style="margin:0;color:var(--gray);">Loading…</p></div>';
  openModal('personModal');

  // Every race entered, with the meet and any official result
  const { data, error } = await window.sb.from('event_entries')
    .select('entry_id, event_name, seed_time_ms, tournaments ( title, start_date ), heat_rows ( finish_time_ms, status, dq_code, official_rank )')
    .eq('swimmer_id', swimmerId);
  if ($('personName').textContent !== sw.name) return;   // another profile was opened meanwhile
  let races;
  if (error) {
    races = `<p style="margin:0;color:#b91c1c;">Couldn't load races: ${escHtml(error.message)}</p>`;
  } else if (!data || !data.length) {
    races = '<p style="margin:0;color:var(--gray);">No races entered yet.</p>';
  } else {
    const rows = data.slice().sort((a, b) => String((b.tournaments || {}).start_date || '').localeCompare(String((a.tournaments || {}).start_date || '')));
    races = `<div style="overflow-x:auto;"><table class="dir-hist">
      <thead><tr><th>Meet</th><th>Race</th><th>Seed</th><th>Result</th><th>Place</th></tr></thead>
      <tbody>${rows.map(e => {
        const h = (e.heat_rows || [])[0] || {};
        const result = h.status && h.status !== 'OK' ? `${h.status}${h.dq_code ? ' ' + h.dq_code : ''}` : msToClock(h.finish_time_ms) || '—';
        return `<tr><td>${escHtml((e.tournaments || {}).title || '—')}</td><td>${escHtml(e.event_name)}</td>
          <td>${msToClock(e.seed_time_ms) || 'NT'}</td><td>${escHtml(result)}</td><td>${h.official_rank ? h.official_rank : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }
  $('personBody').innerHTML = details + `<div class="acd-modal-section"><div class="acd-modal-section-label">Races (${data ? data.length : 0})</div>${races}</div>`;
}

// ─── Tabs ─────────────────────────────────────────────────────
const TAB_COPY = {
  academies: { title: 'Find a swim academy near you', sub: 'Every academy here has been checked by our team: real pool, real coaches, real contact details.', search: 'Academy, coach or area' },
  coaches:   { title: 'Meet the coaches', sub: 'Verified coaches, their certificates and the academies they coach at.', search: 'Coach name, academy or certificate' },
  swimmers:  { title: 'Swimmers', sub: 'Every registered swimmer, their academy and the races they have swum.', search: 'Swimmer name or academy' },
};

function setTab(tab) {
  TAB = TABS.includes(tab) ? tab : 'academies';
  document.querySelectorAll('[data-tab]').forEach(a => {
    if (a.dataset.tab === TAB) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    a.classList.toggle('active', a.dataset.tab === TAB);
  });
  const copy = TAB_COPY[TAB];
  $('adTitle').textContent = copy.title;
  $('adSub').textContent = copy.sub;
  $('acdSearch').placeholder = copy.search;
  $('poolSeg').hidden = TAB !== 'academies';
  $('cityChips').hidden = TAB === 'swimmers';
  $('acdGrid').hidden = TAB !== 'academies';
  $('coachGrid').hidden = TAB !== 'coaches';
  $('swimmerGrid').hidden = TAB !== 'swimmers';
  FILTER.city = ''; FILTER.pool = '';
  $('acdSearch').value = '';
  renderHeroStats();
  renderSide();
  renderCityChips();
  applyFilters();
}

// ─── Filter Logic ─────────────────────────────────────────────
function applyFilters() {
  const q = $('acdSearch').value.trim().toLowerCase();
  $('acdSearchClear').hidden = !q;
  document.querySelectorAll('#cityChips .dir-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.city === FILTER.city)));
  $('swimmerPrivate').hidden = true;

  if (TAB === 'coaches') {
    const list = COACHES.filter(c => {
      const ac = academyOf(c.academy_id);
      const matchQ = !q || c.full_name.toLowerCase().includes(q)
        || (ac && ac.academy_name.toLowerCase().includes(q))
        || c.certifications.some(t => t.toLowerCase().includes(q));
      return matchQ && (!FILTER.city || (ac && ac.city === FILTER.city));
    }).sort((a, b) => a.full_name.localeCompare(b.full_name));
    $('coachGrid').innerHTML = '';
    list.forEach(c => $('coachGrid').appendChild(coachCard(c)));
    $('resultLine').textContent = list.length === 1 ? '1 coach' : `${list.length} coaches`;
    $('acdEmptyText').textContent = 'No coach matches. Try another name or city.';
    $('acdEmpty').hidden = list.length > 0;
    return;
  }

  if (TAB === 'swimmers') {
    $('resultLine').textContent = SWIMMERS.length === 1 ? '1 swimmer' : `${SWIMMERS.length} swimmers`;
    if (!isStaffViewer()) {
      $('swimmerGrid').innerHTML = '';
      $('acdEmpty').hidden = true;
      $('swimmerPrivate').hidden = false;
      return;
    }
    const list = SWIMMERS.filter(sw => !q || sw.name.toLowerCase().includes(q) || (sw.academyName || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    $('swimmerGrid').innerHTML = '';
    list.forEach(sw => $('swimmerGrid').appendChild(swimmerCard(sw)));
    $('resultLine').textContent = list.length === 1 ? '1 swimmer' : `${list.length} swimmers`;
    $('acdEmptyText').textContent = SWIMMERS.length ? 'No swimmer matches that search.' : 'No swimmers registered yet.';
    $('acdEmpty').hidden = list.length > 0;
    return;
  }
  $('acdEmptyText').textContent = 'No academy matches these filters. Try another city or pool length.';

  const result = ACADEMIES.filter(ac => {
    const coaches = getCoachesForAcademy(ac.academy_id);
    const matchQ = !q
      || ac.academy_name.toLowerCase().includes(q)
      || ac.city.toLowerCase().includes(q)
      || ac.address_line.toLowerCase().includes(q)
      || coaches.some(c => c.full_name.toLowerCase().includes(q));
    return matchQ
      && (!FILTER.city || ac.city === FILTER.city)
      && (!FILTER.pool || ac.pool_length === FILTER.pool);
  });

  document.querySelectorAll('#poolSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pool === FILTER.pool)));
  renderGrid(result);
}

function clearFilters() {
  $('acdSearch').value = '';
  FILTER.city = '';
  FILTER.pool = '';
  applyFilters();
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
          ${c.experience_years ? `<i class="fas fa-clock"></i> ${c.experience_years} yrs experience` : ''}
        </div>
      </div>
    </div>`).join('');

  $('acdModalBody').innerHTML = `
    <div class="acd-modal-section">
      <div class="acd-modal-section-label">Academy Details</div>
      <div class="acd-modal-info-grid">
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
          <div class="acd-modal-field-value">${poolLabel(ac.pool_length)} · ${laneLabel(ac.lane_count)} · ${escHtml(ac.pool_type)}</div>
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

  if (!isStaffViewer()) {
    // Swimmers are children, so their names stay private
    $('swimmersModalBody').innerHTML = `
      <div style="padding:32px;text-align:center;color:var(--gray);line-height:1.6;">
        <i class="fas fa-user-shield" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
        ${ac.swimmers.length} swimmer${ac.swimmers.length === 1 ? ' trains' : 's train'} with ${escHtml(ac.academy_name)}.<br>
        Swimmers' names are only shown to meet staff.
      </div>`;
  } else if (ac.swimmers.length === 0) {
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
            <th>Age group</th>
            <th>Gender</th>
          </tr>
        </thead>
        <tbody>
          ${ac.swimmers.map((sw, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${escHtml(sw.name)}</strong></td>
              <td>${sw.category ? `<span class="swimmer-cat-pill">${escHtml(sw.category)}</span>` : '—'}</td>
              <td>${escHtml(sw.gender || '—')}</td>
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

// ─── Supabase: load real academies + coaches + swimmer counts ─
async function loadDirectoryFromDB() {
  if (!window.sb) return; // keep sample data if DB unavailable

  const [acRes, coRes, dirRes] = await Promise.all([
    // Only verified academies and coaches are listed publicly
    window.sb.from('academies').select('*').eq('status', 'APPROVED_ACTIVE').order('academy_name'),
    window.sb.from('coaches').select('*').eq('status', 'APPROVED_ACTIVE'),
    window.sb.from('swimmer_directory').select('swimmer_id, full_name, academy_id, academy_name, category, gender'),
  ]);

  if (acRes.error || !acRes.data || !acRes.data.length) {
    if (acRes.error) console.error('[SwimFest] academies:', acRes.error.message);
    ACADEMIES = []; COACHES = [];
    window.SWIMFEST_ACADEMIES = ACADEMIES;
    window.SWIMFEST_COACHES   = COACHES;
    renderHeroStats();
    renderCityChips();
    renderGrid(ACADEMIES);
    $('resultLine').textContent = acRes.error ? 'Couldn’t load academies' : 'No verified academies yet';
    $('acdEmptyText').textContent = acRes.error
      ? 'Something went wrong loading the directory. Refresh the page to try again.'
      : 'Verified academies will appear here once the SwimFest team has checked them.';
    $('acdClearAll').hidden = true;
    return;
  }

  SWIMMERS = (dirRes.data || []).map(s => ({
    id: s.swimmer_id, name: s.full_name || 'Unknown swimmer', category: s.category || '',
    gender: s.gender === 'Girl' ? 'Girl' : s.gender === 'Boy' ? 'Boy' : '', academyName: s.academy_name || '',
  }));

  // Group swimmers by academy
  const swimmersByAcademy = {};
  (dirRes.data || []).forEach(s => {
    if (!s.academy_id) return;
    (swimmersByAcademy[s.academy_id] = swimmersByAcademy[s.academy_id] || [])
      .push({ name: s.full_name, category: s.category || '', gender: s.gender === 'Girl' ? 'Girl' : s.gender === 'Boy' ? 'Boy' : '' });
  });

  const initialsOf = (name) => {
    const p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'AC';
  };

  ACADEMIES = acRes.data.map(a => ({
    academy_id   : a.academy_id,
    academy_name : a.academy_name,
    address_line : a.address_line || '',
    city         : a.city || '',
    state        : a.state || 'Tamil Nadu',
    contact_person: a.contact_person || '—',
    phone_number : a.phone_number || '—',
    email_id     : a.email_id || '—',
    pool_length  : a.pool_length || '—',
    lane_count   : a.lane_count ? `${a.lane_count}_lanes` : '—',
    pool_type    : a.pool_type || '—',
    status       : a.status === 'APPROVED_ACTIVE' ? 'Active' : (a.status === 'PENDING_VERIFICATION' ? 'Pending' : 'Inactive'),
    initials     : initialsOf(a.academy_name),
    swimmers     : swimmersByAcademy[a.academy_id] || [],
  }));

  COACHES = (coRes.data || []).map(c => ({
    coach_id     : c.coach_id,
    full_name    : c.full_name,
    gender       : c.gender || '',
    mobile_number: c.mobile_number || '—',
    email_id     : c.email_id || '—',
    academy_id   : c.academy_id,
    designation  : c.designation || 'Coach',
    certifications: Array.isArray(c.certifications) ? c.certifications : [],
    experience_years: c.experience_years || 0,
    status       : c.status === 'APPROVED_ACTIVE' ? 'Active' : 'Pending',
  }));

  window.SWIMFEST_ACADEMIES = ACADEMIES;
  window.SWIMFEST_COACHES   = COACHES;

  setTab((location.hash || '').replace('#', ''));
}

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDirectoryFromDB();

  // Search
  $('adSearchForm').addEventListener('submit', e => e.preventDefault());
  $('acdSearch').addEventListener('input', applyFilters);
  $('acdSearchClear').addEventListener('click', () => {
    $('acdSearch').value = '';
    applyFilters();
    $('acdSearch').focus();
  });

  // City buttons and pool length switch
  $('cityChips').addEventListener('click', e => {
    const b = e.target.closest('.dir-chip');
    if (!b) return;
    FILTER.city = b.dataset.city;
    applyFilters();
  });
  $('poolSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-pool]');
    if (!b) return;
    FILTER.pool = b.dataset.pool;
    applyFilters();
  });

  $('acdClearAll').addEventListener('click', clearFilters);

  // Tabs follow the address (#academies / #coaches / #swimmers)
  window.addEventListener('hashchange', () => setTab(location.hash.replace('#', '')));
  document.querySelectorAll('[data-tab]').forEach(a => a.addEventListener('click', () => {
    const menu = document.getElementById('mobileMenu');
    if (menu) menu.classList.remove('active');
  }));
  $('personModalClose').addEventListener('click', () => closeModal('personModal'));
  $('personModal').addEventListener('click', e => { if (e.target === $('personModal')) closeModal('personModal'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ['personModal', 'acdProfileModal', 'acdSwimmersModal'].forEach(closeModal);
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
