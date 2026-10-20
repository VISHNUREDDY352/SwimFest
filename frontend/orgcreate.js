/* ============================================================
   SwimFest — Create a meet (organizer)
   orgcreate.js
   Three steps (details → races & rules → payments), saved to
   tournaments. "Save draft" keeps updating the same row, and the
   meet is always saved with its owner (created_by).
   ============================================================ */

'use strict';

// Strokes × distances. null = not a race swimmers can enter at registration,
// true/false = on by default. Names match registration ("50m Freestyle").
// 25 m races are U-10 only; 200 m Breaststroke/Backstroke are U-14 and up.
const DISTANCES = [25, 50, 100, 200];
const STROKES = [
  { name: 'Freestyle',         on: [true, true, true, true]   },
  { name: 'Backstroke',        on: [true, true, true, true]   },
  { name: 'Breaststroke',      on: [true, true, true, true]   },
  { name: 'Butterfly',         on: [true, true, true, null]   },
  { name: 'Individual Medley', on: [null, null, true, null]   },
];
const SOFTWARE_FEE = 5000;

let SESSION = null;
let step = 0;
let draftId = null;        // set once the meet has been saved; later saves update it
let busy = false;
let dirty = false;         // unsaved changes since the last save
let sent = false;
const poster = { file: null, url: null, preview: null };   // url = saved poster_url

const $ = id => document.getElementById(id);
const val = id => ($(id).value || '').trim();
const segValue = name => document.querySelector(`[data-seg="${name}"] .on`).dataset.v;
const gateway = () => document.querySelector('.oc-opt.on').dataset.gw;
const isSuperAdmin = () => SESSION && SESSION.role === 'super_admin';

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  return d ? new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function markDirty() {
  dirty = true;
  if (draftId && !sent) $('draftBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save draft';
}
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function racesOn() {
  const list = [];
  STROKES.forEach(s => s.on.forEach((v, i) => { if (v) list.push(`${DISTANCES[i]}m ${s.name}`); }));
  return list;
}

// ─── Race matrix ──────────────────────────────────────────────
function renderMatrix() {
  $('matrix').innerHTML = STROKES.map((s, r) => `<tr><td>${s.name}</td>${s.on.map((v, c) => v === null
    ? '<td><span class="oc-chip-na">—</span></td>'
    : `<td><button type="button" class="oc-chip ${v ? 'on' : ''}" data-r="${r}" data-c="${c}" aria-pressed="${v}"
         aria-label="${DISTANCES[c]}m ${s.name}">${v ? 'On' : 'Off'}</button></td>`).join('')}</tr>`).join('');
  const n = racesOn().length;
  const hint = $('raceCount');
  hint.textContent = n
    ? `${n} race${n === 1 ? '' : 's'} on. Each runs for boys and girls in every age group it suits (25 m races are for U-10).`
    : 'Turn on at least one race.';
  hint.className = 'oc-hint' + (n ? '' : ' err');
  renderSummary();
}

// ─── Validation ───────────────────────────────────────────────
function problemsFor(s) {
  const p = [];   // [inputId, message]
  if (s === 0) {
    if (!val('fTitle')) p.push(['fTitle', 'Enter the meet name']);
    if (!val('fHost')) p.push(['fHost', 'Enter the host club']);
    if (!val('fCity')) p.push(['fCity', 'Enter the city']);
    if (!val('fVenue')) p.push(['fVenue', 'Enter the venue']);
    const st = val('fStart'), en = val('fEnd'), dl = val('fDeadline');
    if (!st) p.push(['fStart', 'Pick the first race day']);
    else if (st < today()) p.push(['fStart', 'The first race day is in the past']);
    if (!en) p.push(['fEnd', 'Pick the last race day']);
    else if (st && en < st) p.push(['fEnd', 'The last race day is before the first']);
    if (!dl) p.push(['fDeadline', 'Pick when entries close']);
    else if (st && dl >= st) p.push(['fDeadline', 'Entries must close before racing starts']);
  }
  if (s === 1) {
    if (!racesOn().length) p.push([null, 'Turn on at least one race']);
    [['fBase', 'entry fee'], ['fRelay', 'relay fee']].forEach(([id, label]) => {
      const v = val(id);
      if (v === '' || !/^\d+(\.\d{1,2})?$/.test(v)) p.push([id, `Enter the ${label} in rupees (0 if free)`]);
    });
  }
  return p;
}

function showProblems(list) {
  document.querySelectorAll('.oc-input.bad').forEach(i => i.classList.remove('bad'));
  list.forEach(([id]) => { if (id) $(id).classList.add('bad'); });
  updateDateHint();
  if (list.length) {
    const first = list.find(([id]) => id);
    if (first) $(first[0]).focus();
    showToast(list.length === 1 ? list[0][1] : `${list[0][1]} (and ${list.length - 1} more)`, 'warn');
    restart($('formCard'), 'oc-shake');
  }
}

function updateDateHint() {
  const st = val('fStart'), dl = val('fDeadline'), h = $('dateHint');
  const p = problemsFor(0).find(([id]) => id === 'fDeadline' || id === 'fEnd' || id === 'fStart');
  if (p && (st || dl) && !p[1].startsWith('Pick')) { h.textContent = p[1]; h.className = 'oc-hint err'; return; }
  if (st && dl && dl < st) {
    const days = Math.round((new Date(st) - new Date(dl)) / 864e5);
    h.textContent = `${days} day${days === 1 ? '' : 's'} before racing starts`;
  } else h.textContent = '';
  h.className = 'oc-hint';
}

// ─── Summary ──────────────────────────────────────────────────
function renderSummary() {
  const pool = segValue('pool') === '50m' ? '50 m' : '25 m';
  const races = racesOn().length;
  const rows = [
    ['Meet', val('fTitle')],
    ['Host', val('fHost')],
    ['Where', [val('fVenue'), val('fCity')].filter(Boolean).join(', ')],
    ['Pool', `${pool} · ${segValue('lanes')} lanes`],
    ['Dates', val('fStart') && val('fEnd') ? (val('fStart') === val('fEnd') ? fmtDate(val('fStart')) : `${fmtDate(val('fStart'))} – ${fmtDate(val('fEnd'))}`) : ''],
    ['Entries close', fmtDate(val('fDeadline'))],
    ['Races', races ? `${races} race${races === 1 ? '' : 's'}` : ''],
    ['Entry fee', val('fBase') !== '' ? `₹${val('fBase')}` : ''],
    ['Payments', gateway() === 'A' ? 'Online on SwimFest' : 'Collected by you'],
    ['Poster', poster.file || poster.url ? 'Added' : 'None'],
  ];
  $('sumList').innerHTML = rows.map(([k, v]) =>
    `<li><span>${k}</span><span class="${v ? '' : 'missing'}">${v ? escHtml(v) : 'Missing'}</span></li>`).join('');
}

// ─── Steps ────────────────────────────────────────────────────
function go(n) {
  n = Math.max(0, Math.min(2, n));
  if (n === step || sent) return;
  // Moving forward checks every step being skipped over
  for (let s = step; s < n; s++) {
    const p = problemsFor(s);
    if (p.length) { if (s !== step) showPanel(s, false); showProblems(p); return; }
  }
  showPanel(n, n > step);
}

function showPanel(n, forward) {
  step = n;
  document.querySelectorAll('[data-panel]').forEach(p => {
    const show = Number(p.dataset.panel) === n;
    p.hidden = !show;
    p.classList.remove('oc-slide-next', 'oc-slide-prev');
    if (show) restart(p, forward ? 'oc-slide-next' : 'oc-slide-prev');
  });
  document.querySelectorAll('.oc-step').forEach((s, i) => {
    const done = i < n || n === 3;
    s.classList.toggle('on', i === n);
    s.classList.toggle('done', done);
    s.querySelector('.n').innerHTML = done ? '<i class="fas fa-check"></i>' : i + 1;
    if (i === n) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
  });
  $('trackFill').style.width = `calc((100% - 2.5rem) * ${Math.min(n, 2) / 2})`;
  $('formFoot').hidden = n === 3;
  $('backBtn').disabled = n === 0;
  $('nextBtn').innerHTML = n === 2
    ? (isSuperAdmin() ? '<i class="fas fa-paper-plane"></i> Publish meet' : '<i class="fas fa-paper-plane"></i> Send for approval')
    : 'Continue <i class="fas fa-arrow-right"></i>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Save ─────────────────────────────────────────────────────
function collect(status) {
  return {
    title:                 val('fTitle'),
    host_organization:     val('fHost'),
    state:                 val('fState'),
    city:                  val('fCity'),
    venue_name:            val('fVenue'),
    pool_length:           segValue('pool'),
    lane_count:            Number(segValue('lanes')),
    start_date:            val('fStart'),
    end_date:              val('fEnd'),
    registration_deadline: val('fDeadline') || null,
    reg_fee_amount:        Number(val('fBase')),
    relay_add_on_fee:      Number(val('fRelay')),
    allow_swim_up:         $('swSwimUp').classList.contains('on'),
    non_medalist_rule:     $('swNonMedal').classList.contains('on'),
    gateway_option:        gateway() === 'A' ? 'OPTION_A_PLATFORM_GATEWAY' : 'OPTION_B_NO_GATEWAY',
    events_offered:        racesOn(),
    poster_url:            poster.url,
    status,
  };
}

// Inserts the meet the first time, then updates that same row.
async function saveMeet(status) {
  if (!window.sb) { showToast('Not connected to the database. Refresh the page and try again.', 'warn'); return null; }
  if (!SESSION || !SESSION.userId) { showToast('Your sign-in has expired. Log in again to save this meet.', 'warn'); return null; }

  if (!(await uploadPoster())) return null;
  const row = collect(status);
  let res;
  if (draftId) {
    res = await window.sb.from('tournaments').update(row).eq('tournament_id', draftId).select('tournament_id');
    if (!res.error && (!res.data || !res.data.length)) {
      showToast('This draft could not be updated. It may have been deleted or already sent.', 'warn');
      return null;
    }
  } else {
    row.created_by = SESSION.userId;
    res = await window.sb.from('tournaments').insert(row).select('tournament_id');
  }

  if (res.error) {
    const msg = res.error.message || '';
    console.error('[SwimFest] save meet:', msg);
    if (msg.includes('events_offered')) {
      showToast('The races list can\'t be saved until the database is updated. Run backend/db/add_events_offered.sql in Supabase, then try again.', 'warn');
    } else {
      showToast('Couldn\'t save the meet: ' + msg, 'warn');
    }
    return null;
  }
  draftId = res.data[0].tournament_id;
  dirty = false;
  return draftId;
}

async function saveDraft() {
  if (busy || sent) return;
  const p = problemsFor(0);
  if (p.length) {
    if (step !== 0) showPanel(0, false);
    showProblems(p);
    showToast('Fill in the meet details first. A draft needs a name, venue and dates.', 'warn');
    return;
  }
  busy = true;
  $('draftBtn').disabled = true;
  const wasNew = !draftId;
  const id = await saveMeet('DRAFT');
  busy = false;
  $('draftBtn').disabled = false;
  if (id) {
    $('draftBtn').innerHTML = '<i class="fas fa-check"></i> Draft saved';
    showToast(wasNew ? 'Draft saved. It\'s in My meets as a draft.' : 'Draft updated.', 'success');
  }
}

async function submitMeet() {
  if (busy || sent) return;
  for (let s = 0; s < 2; s++) {
    const p = problemsFor(s);
    if (p.length) { showPanel(s, false); showProblems(p); return; }
  }
  busy = true;
  const btn = $('nextBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sending…';

  // A super admin is the approver, so their meets go live straight away
  const id = await saveMeet(isSuperAdmin() ? 'PUBLISHED' : 'PENDING_APPROVAL');
  busy = false;
  btn.disabled = false;
  if (!id) { showPanel(2, false); return; }

  sent = true;
  $('draftBtn').disabled = true;
  $('doneTitle').textContent = isSuperAdmin() ? 'Meet published' : 'Sent for approval';
  const fee = gateway() === 'B'
    ? ` The ₹${SOFTWARE_FEE.toLocaleString('en-IN')} software fee hasn't been charged; online payment of it is coming soon.`
    : '';
  $('doneText').textContent = isSuperAdmin()
    ? `${val('fTitle')} is live on the public site and open for entries.`
    : `${val('fTitle')} is waiting for the super admin. You'll see its status in My meets, and it goes live once approved.${fee}`;
  showPanel(3, true);
}

// ─── Poster ───────────────────────────────────────────────────
const POSTER_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function renderPoster() {
  const src = poster.preview || poster.url;
  $('posterPreview').hidden = !src;
  if (src) $('posterPreview').src = src;
  $('posterEmpty').hidden = !!src;
  $('posterEmpty').style.display = src ? 'none' : '';
  $('posterRemove').hidden = !src;
  $('posterPick').innerHTML = src ? '<i class="fas fa-upload"></i> Change image' : '<i class="fas fa-upload"></i> Choose image';
  renderSummary();
}

function pickPoster(file) {
  if (!file) return;
  if (!POSTER_TYPES[file.type]) { showToast('Use a JPG, PNG or WebP image for the poster.', 'warn'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('That image is over 5 MB. Pick a smaller one.', 'warn'); return; }
  if (poster.preview) URL.revokeObjectURL(poster.preview);
  poster.file = file;
  poster.preview = URL.createObjectURL(file);
  markDirty();
  renderPoster();
}

function removePoster() {
  if (poster.preview) URL.revokeObjectURL(poster.preview);
  poster.file = null; poster.preview = null; poster.url = null;
  markDirty();
  renderPoster();
}

// Uploads a newly chosen poster into the user's own folder; true when
// there is nothing to upload or the upload worked.
async function uploadPoster() {
  if (!poster.file) return true;
  const path = `${SESSION.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${POSTER_TYPES[poster.file.type]}`;
  const bucket = window.sb.storage.from('meet-posters');
  const { error } = await bucket.upload(path, poster.file, { contentType: poster.file.type, upsert: false });
  if (error) {
    console.error('[SwimFest] poster upload:', error.message);
    showToast(/bucket/i.test(error.message)
      ? "Poster storage isn't set up yet. Run backend/db/meet_posters_storage.sql in Supabase, or remove the poster to save without it."
      : "Couldn't upload the poster: " + error.message, 'warn');
    return false;
  }
  poster.url = bucket.getPublicUrl(path).data.publicUrl;
  poster.file = null;
  return true;
}

// ─── Reopen a draft or a returned meet (?id=) ─────────────────
async function loadExistingMeet() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id || !window.sb || !SESSION) return;
  let q = window.sb.from('tournaments').select('*').eq('tournament_id', id);
  if (!isSuperAdmin()) q = q.eq('created_by', SESSION.userId);
  const { data: t, error } = await q.maybeSingle();
  if (error || !t) { showToast('That meet could not be opened. It may belong to another account.', 'warn'); return; }
  if (!['DRAFT', 'REJECTED_DRAFT'].includes(t.status)) {
    showToast('Only drafts and meets sent back by the super admin can be edited here.', 'warn');
    return;
  }

  draftId = t.tournament_id;
  const set = (fid, v) => { if (v != null) $(fid).value = v; };
  set('fTitle', t.title); set('fHost', t.host_organization); set('fCity', t.city); set('fVenue', t.venue_name);
  if (t.state) {
    const sel = $('fState');
    if (![...sel.options].some(o => o.value === t.state)) sel.add(new Option(t.state, t.state));
    sel.value = t.state;
  }
  set('fStart', t.start_date); set('fEnd', t.end_date);
  set('fDeadline', t.registration_deadline ? String(t.registration_deadline).slice(0, 10) : '');
  set('fBase', t.reg_fee_amount); set('fRelay', t.relay_add_on_fee);
  const pick = (seg, v) => document.querySelectorAll(`[data-seg="${seg}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
  if (t.pool_length) pick('pool', t.pool_length);
  if (t.lane_count) pick('lanes', t.lane_count);
  const sw = (sid, on) => { $(sid).classList.toggle('on', !!on); $(sid).setAttribute('aria-pressed', !!on); };
  sw('swNonMedal', t.non_medalist_rule);
  sw('swSwimUp', t.allow_swim_up);
  const gw = t.gateway_option === 'OPTION_A_PLATFORM_GATEWAY' ? 'A' : 'B';
  document.querySelectorAll('.oc-opt').forEach(o => o.classList.toggle('on', o.dataset.gw === gw));
  $('feeBox').hidden = gw === 'A';
  if (Array.isArray(t.events_offered) && t.events_offered.length) {
    const on = new Set(t.events_offered);
    STROKES.forEach(s => s.on.forEach((v, i) => { if (v !== null) s.on[i] = on.has(`${DISTANCES[i]}m ${s.name}`); }));
  }

  poster.url = t.poster_url || null;
  renderPoster();

  const returned = t.status === 'REJECTED_DRAFT';
  $('ocHeading').textContent = returned ? 'Fix and resend' : 'Edit draft';
  $('ocSubheading').textContent = returned
    ? 'The super admin sent this meet back. Make your changes, then send it for approval again.'
    : 'Carry on where you left off, then send it to the super admin for approval.';
  document.title = `${$('ocHeading').textContent} — SwimFest`;
  $('draftBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save draft';
  renderMatrix();
  updateDateHint();
  renderSummary();
  dirty = false;
}

// ─── Staff sidebar ────────────────────────────────────────────
// Admins (and super admins) create meets here too ("Add meet"),
// so they get the Admin console links instead of the organizer's.
const isStaff = () => SESSION && ['event_manager', 'super_admin'].includes(SESSION.role);

function renderStaffNav() {
  if (!isStaff()) return;
  const link = (href, icon, label, active) =>
    `<a href="${href}" class="ac-side-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}><i class="fas fa-${icon}"></i> ${label}</a>`;
  $('ocNav').innerHTML = `
    <nav class="ac-side-group">${link('admin.html', 'table-columns', 'Overview')}${link('admin.html#verificationQueues', 'clipboard-check', 'Approvals')}</nav>
    <nav class="ac-side-group" aria-label="Meets"><div class="ac-side-label">Meets</div>
      ${link('admin.html#myMeets', 'trophy', 'My meets')}${link('playerlist.html', 'list-check', 'Master player list')}
      ${link('heatgen.html', 'bolt', 'Heat generation')}${link('results.html', 'broadcast-tower', 'Live results')}
      ${link('orgracecontrol.html', 'flag-checkered', 'Race control')}</nav>
    <nav class="ac-side-group" aria-label="Create"><div class="ac-side-label">Create</div>${link('orgcreate.html', 'plus', 'Add meet', true)}</nav>`;
  $('ocBrand').setAttribute('href', 'admin.html');
  $('ocBrandSub').textContent = 'Admin Console';
  $('doneMyMeets').setAttribute('href', 'admin.html#myMeets');
  if (SESSION.role === 'super_admin') { $('ocUserLink').setAttribute('href', 'saprofile.html'); $('ocUserLink').title = 'Your profile'; }
  else { $('ocUserLink').removeAttribute('href'); $('ocUserLink').removeAttribute('title'); }
}

// ─── Prefill + sidebar ────────────────────────────────────────
async function loadOrganization() {
  if (!SESSION) return;
  const name = SESSION.name || SESSION.email || 'Signed in';
  $('ocUserName').textContent = name;
  $('ocUserRole').textContent = { super_admin: 'Super Admin', event_manager: 'Admin' }[SESSION.role] || 'Organizer';
  $('ocInitials').textContent = String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'OR';
  if (isSuperAdmin()) $('sumStatus').innerHTML = 'You\'re a super admin, so this meet is <b>published straight away</b> when you press Publish.';

  if (!window.sb || !SESSION.userId || isStaff()) return;
  const { data: org } = await window.sb.from('organizers').select('org_name, city, state').eq('owner_id', SESSION.userId).maybeSingle();
  if (!org) return;
  if (org.org_name) {
    $('ocUserName').textContent = org.org_name;
    $('ocInitials').textContent = org.org_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    if (!val('fHost')) { $('fHost').value = org.org_name; $('hostHint').textContent = 'Filled in from your organization profile'; }
  }
  renderSummary();
}

function setNavOpen(open) {
  $('acShell').classList.toggle('nav-open', open);
  $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const existing = document.querySelector('.admin-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'warn' ? 'exclamation-triangle' : 'info-circle';
  toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4500);
}

(function() {
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast { position:fixed; bottom:28px; right:28px; z-index:99999;
      padding:12px 20px; background:#0f172a; color:#fff;
      border-radius:10px; font-size:0.85rem; font-weight:500;
      display:flex; align-items:center; gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);
      transform:translateY(20px); opacity:0; transition:all 0.3s ease;
      max-width:440px; font-family:'Inter',sans-serif; }
    .admin-toast.show { transform:translateY(0); opacity:1; }
    .admin-toast i { color:#38bdf8; }
    .admin-toast.admin-toast-success i { color:#4ade80; }
    .admin-toast.admin-toast-warn    i { color:#fbbf24; }`;
  document.head.appendChild(s);
})();

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  SESSION = window.SwimAuth ? window.SwimAuth.getSession() : null;
  renderStaffNav();
  if (window.SwimNav) window.SwimNav.applySuperAdmin({ nav: 'ocNav', brand: 'ocBrand', brandSub: 'ocBrandSub', userLink: 'ocUserLink', name: 'ocUserName', initials: 'ocInitials', role: 'ocUserRole' }, 'orgcreate.html');
  $('fStart').min = today();
  $('fEnd').min = today();
  renderMatrix();
  renderSummary();
  loadExistingMeet().then(loadOrganization);

  $('matrix').addEventListener('click', e => {
    const b = e.target.closest('.oc-chip');
    if (!b) return;
    const s = STROKES[b.dataset.r];
    s.on[b.dataset.c] = !s.on[b.dataset.c];
    markDirty();
    renderMatrix();
  });

  document.querySelectorAll('.oc-input').forEach(i => {
    const onEdit = () => {
      i.classList.remove('bad');
      if (i.id === 'fStart' && val('fStart')) $('fEnd').min = val('fStart');
      markDirty();
      updateDateHint();
      renderSummary();
    };
    i.addEventListener('input', onEdit);
    i.addEventListener('change', onEdit);
  });
  $('fHost').addEventListener('input', () => { $('hostHint').textContent = ''; });

  document.querySelectorAll('.oc-seg').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    markDirty();
    renderSummary();
  }));
  document.querySelectorAll('.oc-sw').forEach(sw => sw.addEventListener('click', () => {
    const on = sw.classList.toggle('on');
    sw.setAttribute('aria-pressed', on);
    markDirty();
  }));
  document.querySelectorAll('.oc-opt').forEach(o => o.addEventListener('click', () => {
    document.querySelectorAll('.oc-opt').forEach(x => x.classList.toggle('on', x === o));
    $('feeBox').hidden = o.dataset.gw === 'A';
    markDirty();
    renderSummary();
  }));

  $('nextBtn').addEventListener('click', () => { if (step < 2) go(step + 1); else submitMeet(); });
  $('backBtn').addEventListener('click', () => go(step - 1));
  document.querySelectorAll('.oc-step').forEach(s => s.addEventListener('click', () => go(Number(s.dataset.step))));
  $('draftBtn').addEventListener('click', saveDraft);
  $('posterPick').addEventListener('click', () => $('posterFile').click());
  $('posterFile').addEventListener('change', e => { pickPoster(e.target.files[0]); e.target.value = ''; });
  $('posterRemove').addEventListener('click', removePoster);

  $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
  $('acScrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setNavOpen(false); });

  window.addEventListener('beforeunload', e => {
    if (!dirty || sent) return;
    e.preventDefault();
    e.returnValue = '';
  });
});
