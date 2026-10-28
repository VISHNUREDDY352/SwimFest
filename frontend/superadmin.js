/* ============================================================
   SwimFest — Super Admin Console JS   superadmin.js
   ============================================================ */
'use strict';

// Live data pulled from Supabase (see load* functions below)
let S1A_QUEUE = [];   // pending internal meets (Option A gateway)
let SENT_BACK = [];   // meets returned to their organizer (REJECTED_DRAFT)
let S1B_QUEUE = [];   // pending third-party meets (Option B gateway)
let S2_QUEUE  = [];   // pending academy / coach verifications

// ── Utilities ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Initials avatar used in the first column of each queue row
function avatarHtml(name, i) {
  const initials = String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return `<span class="sa-avatar sa-av-${i % 4}">${escHtml(initials)}</span>`;
}

function emptyRow(msg) {
  return `<tr><td colspan="5" class="sa-empty-cell">
    <div class="sa-empty-icon"><i class="fas fa-check"></i></div>
    <div style="font-weight:700;color:var(--sa-ink);margin-bottom:4px;">You're all caught up</div>
    ${escHtml(msg)}
  </td></tr>`;
}

// Pending counts per queue: tab pill, sidebar sub-item and sidebar total
const QUEUE_COUNTS = { s2: 0, s1a: 0, s1b: 0, reopen: 0 };
function setQueueCount(key, n, label) {
  QUEUE_COUNTS[key] = n;
  const pill = $(`${key}Badge`);
  if (pill) {
    pill.textContent = label || String(n);
    pill.classList.toggle('has-items', n > 0);
  }
  document.querySelectorAll(`[data-count-for="${key}"]`).forEach(el => { el.textContent = n; });
  const total = Object.values(QUEUE_COUNTS).reduce((a, b) => a + b, 0);
  if ($('kpiPending')) $('kpiPending').textContent = total;
  const totalEl = $('saTotalPending');
  if (totalEl) {
    totalEl.textContent = total;
    totalEl.classList.toggle('is-zero', total === 0);
  }
}

function openModal(id)  { const m=$(id); m.classList.add('active'); m.style.display='flex'; }
function closeModal(id) { const m=$(id); m.classList.remove('active'); m.style.display='none'; }
window.closeModal = closeModal;

function showToast(msg, type='info') {
  const e = document.querySelector('.admin-toast'); if(e) e.remove();
  const t = document.createElement('div');
  t.className = `admin-toast admin-toast-${type}`;
  const icon = type==='success'?'check-circle':type==='warn'?'exclamation-triangle':'info-circle';
  t.innerHTML = `<i class="fas fa-${icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},3500);
}
window.showToast = showToast;

// ── Supabase: metrics ─────────────────────────────────────────
function fmtDateRange(s, e) {
  const f = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '';
  return s ? `${f(s)}${e ? ' – ' + f(e) : ''}` : '—';
}

const money = n => '₹' + n.toLocaleString('en-IN');

// Numbers worked out from the meets list (no extra requests)
function renderMeetMetrics() {
  const cards = document.querySelectorAll('.sa-metric-value');
  if (cards[0]) cards[0].textContent = ALL_MEETS.filter(t => t.status === 'PUBLISHED' || t.status === 'LOCKED').length;
  // Offline (Option B) meets that are live owe the ₹5,000 software fee, which can't be paid online yet
  const offline = ALL_MEETS.filter(t => t.gateway_option === 'OPTION_B_NO_GATEWAY'
    && ['PUBLISHED', 'CLOSED', 'LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'].includes(t.status)).length;
  $('saPendingPayouts').textContent = `${offline} meet${offline === 1 ? '' : 's'} · ${money(offline * 5000)} not collected`;
}

// Swimmer and academy counts
async function loadPeopleMetrics() {
  if (!window.sb) return;
  const cards = document.querySelectorAll('.sa-metric-value');
  try {
    const swimmers = await window.sb.from('swimmer_directory').select('swimmer_id', { count:'exact', head:true });
    if (cards[1]) cards[1].textContent = (swimmers.count ?? 0).toLocaleString('en-IN');
  } catch (e) { console.warn('[SwimFest] people metrics:', e.message); }
}

// Average time from a submission arriving to the first approve / reject
// decision on it, over the last 30 days (read from the audit log)
const REVIEW_TABLES = {
  TOURNAMENT: ['tournaments', 'tournament_id'], SWIMMER: ['swimmers', 'swimmer_id'],
  ACADEMY: ['academies', 'academy_id'], COACH: ['coaches', 'coach_id'], ORGANIZER: ['organizers', 'organizer_id'],
};
async function loadTurnaround() {
  const el = $('kpiTurnaround');
  if (!window.sb || !el) return;
  try {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data: logs } = await window.sb.from('system_audit_logs')
      .select('action_type, target_entity, target_entity_id, created_at')
      .gte('created_at', since)
      .or('action_type.like.%_VERIFIED,action_type.like.%_REJECTED,action_type.eq.EVENT_APPROVED')
      .order('created_at', { ascending: true });
    // First decision per submission
    const first = {};
    (logs || []).forEach(l => {
      const key = `${l.target_entity}:${l.target_entity_id}`;
      if (REVIEW_TABLES[l.target_entity] && l.target_entity_id && !first[key]) first[key] = l;
    });
    const byEntity = {};
    Object.values(first).forEach(l => (byEntity[l.target_entity] = byEntity[l.target_entity] || []).push(l));
    const hours = [];
    await Promise.all(Object.entries(byEntity).map(async ([entity, list]) => {
      const [table, idCol] = REVIEW_TABLES[entity];
      const { data } = await window.sb.from(table).select(`${idCol}, created_at`).in(idCol, list.map(l => l.target_entity_id));
      const created = Object.fromEntries((data || []).map(r => [String(r[idCol]), r.created_at]));
      list.forEach(l => {
        const c = created[String(l.target_entity_id)];
        const h = c ? (new Date(l.created_at) - new Date(c)) / 36e5 : NaN;
        if (h >= 0) hours.push(h);
      });
    }));
    if (!hours.length) { el.textContent = '—'; el.title = 'No decisions in the last 30 days'; return; }
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
    el.textContent = avg < 1 ? `${Math.max(1, Math.round(avg * 60))} min` : avg < 48 ? `${avg.toFixed(1)} hrs` : `${(avg / 24).toFixed(1)} days`;
    el.title = `Based on ${hours.length} decision${hours.length === 1 ? '' : 's'} in the last 30 days`;
  } catch (e) { console.warn('[SwimFest] review turnaround:', e.message); }
}

// Money: registrations, paid and not paid yet
async function loadMetrics() {
  if (!window.sb) return;
  try {
    const bookings = await window.sb.from('bookings').select('total_amount, payment_status');

    // Only bookings marked PAID count as money received
    const rows = bookings.data || [];
    const sum = list => list.reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const paid = rows.filter(b => b.payment_status === 'PAID');
    const unpaid = rows.filter(b => b.payment_status !== 'PAID');
    $('saTotalTxns').textContent = rows.length.toLocaleString('en-IN');
    $('saGrossRevenue').textContent = `${money(sum(paid))} · ${paid.length} booking${paid.length === 1 ? '' : 's'}`;
    $('saPendingFees').textContent = `${money(sum(unpaid))} · ${unpaid.length} booking${unpaid.length === 1 ? '' : 's'}`;
  } catch (e) { console.warn('[SwimFest] metrics:', e.message); }
}

// ── Supabase: pending meet queues ─────────────────────────────
const CREATORS = {};   // profile id → { role, email }, kept between refreshes

async function buildMeetQueues() {
  const rows = ALL_MEETS.filter(t => t.status === 'PENDING_APPROVAL')
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  // Who created each meet: staff (Admin / super admin) → internal (1A),
  // anyone else (organizers) → third-party (1B). Only unknown creators are looked up.
  const missing = [...new Set(rows.map(t => t.created_by).filter(id => id && !CREATORS[id]))];
  if (missing.length) {
    // profiles has no email column; role is what decides the queue
    const { data: ps } = await window.sb.from('profiles').select('id, role').in('id', missing);
    (ps || []).forEach(p => { CREATORS[p.id] = p; });
  }
  const creators = CREATORS;
  const isStaffMeet = t => ['event_manager', 'super_admin'].includes((creators[t.created_by] || {}).role);
  const emailOf = t => t.created_by_email || null;

  S1A_QUEUE = rows.filter(isStaffMeet).map(t => ({
    id: t.tournament_id, createdBy: t.host_organization || '—', title: t.title,
    createdByEmail: emailOf(t),
    dates: fmtDateRange(t.start_date, t.end_date), venue: `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`,
  }));
  S1B_QUEUE = rows.filter(t => !isStaffMeet(t)).map(t => ({
    id: t.tournament_id, organizer: t.host_organization || '—', title: t.title,
    createdByEmail: emailOf(t),
    payType: t.gateway_option === 'OPTION_A_PLATFORM_GATEWAY' ? 'A' : 'B',
  }));

  renderS1A();
  renderS1B();

  SENT_BACK = ALL_MEETS.filter(t => t.status === 'REJECTED_DRAFT')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  renderSentBack();

  // Meets sent back before reasons were saved on the meet: take the reason from the audit log
  const legacy = SENT_BACK.filter(t => !t.rejection_notes && !(t.tournament_id in AUDIT_REASONS)).map(t => t.tournament_id);
  if (legacy.length) {
    const { data } = await window.sb.from('system_audit_logs')
      .select('target_entity_id, notes, created_at').eq('action_type', 'EVENT_REJECTED')
      .in('target_entity_id', legacy).order('created_at', { ascending: false });
    legacy.forEach(id => { AUDIT_REASONS[id] = null; });
    (data || []).forEach(r => {
      const m = /Reason:\s*([\s\S]+)/.exec(r.notes || '');
      if (m && !AUDIT_REASONS[r.target_entity_id]) AUDIT_REASONS[r.target_entity_id] = m[1].trim();
    });
    renderSentBack();
  }
}
const AUDIT_REASONS = {};   // tournament id → reason found in the audit log (null: none recorded)

// Sent back meets wait on the organizer, not on you, so they don't add to the Approvals total
function renderSentBack() {
  const n = SENT_BACK.length;
  const pill = $('sentbackBadge');
  if (pill) { pill.textContent = String(n); pill.classList.remove('has-items'); }
  document.querySelectorAll('[data-count-for="sentback"]').forEach(el => { el.textContent = n; });
  if (!n) {
    $('sentbackBody').innerHTML = emptyRow('No meets are waiting on their organizer for changes.');
    return;
  }
  $('sentbackBody').innerHTML = SENT_BACK.map((t, i) => {
    const host = t.host_organization || '—';
    const reason = t.rejection_notes || AUDIT_REASONS[t.tournament_id];
    const reasonHtml = reason
      ? `<div class="sa-reason">${escHtml(reason)}</div>`
      : `<span style="font-size:0.78rem;color:var(--gray);">No reason recorded (sent back before reasons were required)</span>`;
    return `<tr>
      <td><div class="sa-person">${avatarHtml(host, i)}<div><div class="sa-meet-title">${escHtml(host)}</div>
        <div style="font-size:0.72rem;color:var(--gray);margin-top:2px;">Waiting on organizer</div></div></div></td>
      <td><div class="sa-meet-title">${escHtml(t.title)}</div></td>
      <td>${escHtml(fmtDateRange(t.start_date, t.end_date))}<div style="font-size:0.75rem;color:var(--gray);">${escHtml(`${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`)}</div></td>
      <td style="max-width:22rem;">${reasonHtml}</td>
      <td><button class="sa-btn-approve" onclick="approveSentBack(${i})"><i class="fas fa-check"></i> Approve &amp; publish</button></td>
    </tr>`;
  }).join('');
  applyQueueSearch();
}

// Publish a sent-back meet as it is, without waiting for the organizer's changes
window.approveSentBack = function (i) {
  const t = SENT_BACK[i];
  if (!t) return;
  if (!confirm(`Publish "${t.title}" as it is? It was sent back to the organizer for changes, and they haven't resubmitted it yet.`)) return;
  approveMeetDirect(t.tournament_id, t.title);
};

// ── Supabase: pending academy / coach / swimmer verifications ─
let swimmerStatusMissing = false;   // the live swimmers table may have no status column

async function loadVerificationQueue() {
  if (!window.sb) return;
  const waiting = q => q.eq('status', 'PENDING_VERIFICATION');
  const [swRes, orgRes, acRes, coRes] = await Promise.all([
    swimmerStatusMissing ? Promise.resolve({ data: [] }) : waiting(window.sb.from('swimmers').select('*')),
    waiting(window.sb.from('organizer_directory').select('*')),
    waiting(window.sb.from('academies').select('*')),
    waiting(window.sb.from('coaches').select('*')),
  ]);
  if (swRes.error && /status/i.test(swRes.error.message)) swimmerStatusMissing = true;   // stop asking
  ['swimmers', 'organizers', 'academies', 'coaches'].forEach((name, i) => {
    const r = [swRes, orgRes, acRes, coRes][i];
    if (r.error && !(i === 0 && swimmerStatusMissing)) console.warn(`[SwimFest] ${name} queue query:`, r.error.message);
  });

  S2_QUEUE = [];
  (swRes.data || []).forEach(s => S2_QUEUE.push({
    id: s.swimmer_id, table: 'swimmers', idCol: 'swimmer_id',
    entityType: 'SWIMMER', name: s.full_name,
    detail: `${s.gender || ''} ${s.category || ''} ${s.date_of_birth ? '(DOB: ' + s.date_of_birth + ')' : ''} · Parent: ${s.parent_name || '—'} (${s.parent_phone || '—'}) ${s.school_name ? '· School: ' + s.school_name : ''} ${s.id_ref ? '· ID/Ref: ' + s.id_ref : ''}`,
    email: s.parent_email || null,
    credentialId: s.sfi_serial_no || `SWM-${String(s.swimmer_id).slice(0,8).toUpperCase()}`,
    documentUrl: null,
  }));
  (orgRes.data || []).forEach(o => S2_QUEUE.push({
    id: o.organizer_id, table: 'organizers', idCol: 'organizer_id',
    entityType: 'ORGANIZER', name: o.org_name, detail: `Contact: ${o.contact_person || '—'} · ${o.city || ''}`,
    email: o.email || null, credentialId: o.registration_no || '—', documentUrl: o.document_url || null,
  }));
  (acRes.data || []).forEach(a => S2_QUEUE.push({
    id: a.academy_id, table: 'academies', idCol: 'academy_id',
    entityType: 'ACADEMY', name: a.academy_name, detail: `Location: ${a.city || '—'}`,
    email: a.created_by_email || null, credentialId: a.registration_no || '—', documentUrl: a.document_url || null,
  }));
  (coRes.data || []).forEach(c => S2_QUEUE.push({
    id: c.coach_id, table: 'coaches', idCol: 'coach_id',
    entityType: 'COACH', name: c.full_name, detail: c.designation || 'Coach',
    email: c.created_by_email || null, credentialId: Array.isArray(c.certifications) ? c.certifications.join(', ') : '—', documentUrl: c.document_url || null,
  }));

  renderS2();
}

// ── Supabase: meet reopen requests (from organizers) ──────────
let REOPEN_QUEUE = [];
async function loadReopenQueue() {
  if (!window.sb) return;
  const { data, error } = await window.sb
    .from('reopen_request_queue')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });
  if (error) { console.error('[SwimFest] reopen queue:', error.message); return; }
  REOPEN_QUEUE = data || [];
  renderReopenQueue();
}

function renderReopenQueue() {
  const body  = $('reopenBody');
  setQueueCount('reopen', REOPEN_QUEUE.length);
  if (!body) return;
  if (!REOPEN_QUEUE.length) {
    body.innerHTML = emptyRow('No organizers have asked to reopen a completed meet.');
    return;
  }
  body.innerHTML = REOPEN_QUEUE.map((r, i) => `
    <tr id="reopen-row-${i}">
      <td>
        <div class="sa-person">${avatarHtml(r.org_name || 'Organizer', i)}<div>
          <div class="sa-meet-title">${escHtml(r.org_name || 'Organizer')}</div>
          <div class="sa-meet-sub">${escHtml(r.contact_person || '')}</div>
        </div></div>
      </td>
      <td>${escHtml(r.tournament_title || '')}</td>
      <td style="max-width:260px;">${escHtml(r.reason || '')}</td>
      <td style="font-size:0.75rem;color:var(--gray);">${escHtml(new Date(r.created_at).toLocaleString('en-IN'))}</td>
      <td id="reopen-act-${i}">
        <button class="sa-btn-approve" onclick="approveReopen(${i})"><i class="fas fa-check"></i> Approve &amp; Reopen</button>
        <button class="sa-btn-reject" onclick="denyReopen(${i})"><i class="fas fa-times"></i> Deny</button>
      </td>
    </tr>`).join('');
  applyQueueSearch();
}

window.approveReopen = async function(i) {
  const r = REOPEN_QUEUE[i];
  if (!r || !window.sb) return;
  // Role matrix: the Owner reopens by right; a Co-Super Admin must give a justification
  let why = '';
  if (!IS_OWNER) {
    why = await SwimReason.ask({ title: 'Why reopen this meet?', subject: r.tournament_title, action: 'Reopen',
      placeholder: 'e.g. A timing error in the 50m Freestyle heat 2 was confirmed by the referee; results must be corrected.' });
    if (!why) return;
  }
  const { error } = await window.sb.rpc('approve_reopen', { p_request_id: r.request_id });
  if (error) { console.error('[SwimFest] approve reopen:', error.message); showToast('Approve failed: ' + error.message, 'warn'); return; }
  await writeAudit('MEET_REOPENED', 'TOURNAMENT', r.tournament_id, `Reopen approved: ${r.tournament_title}${why ? `\nReason: ${why}` : ''}`);
  const act = $(`reopen-act-${i}`);
  if (act) act.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Reopened</span>`;
  showToast(`Meet reopened: ${r.tournament_title}`, 'success');
  recountBadge('reopen');
};

window.denyReopen = async function(i) {
  const r = REOPEN_QUEUE[i];
  if (!r || !window.sb) return;
  const { error } = await window.sb.rpc('deny_reopen', { p_request_id: r.request_id });
  if (error) { console.error('[SwimFest] deny reopen:', error.message); showToast('Deny failed: ' + error.message, 'warn'); return; }
  await writeAudit('MEET_REOPEN_DENIED', 'TOURNAMENT', r.tournament_id, `Reopen denied: ${r.tournament_title}`);
  const act = $(`reopen-act-${i}`);
  if (act) act.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Denied</span>`;
  showToast(`Reopen denied: ${r.tournament_title}`, 'warn');
  recountBadge('reopen');
};

// ── Section 1A: Internal Meets ────────────────────────────────
function renderS1A() {
  setQueueCount('s1a', S1A_QUEUE.length);
  if (!S1A_QUEUE.length) {
    $('s1aBody').innerHTML = emptyRow('No internal meets from Admins are waiting for approval.');
    return;
  }
  $('s1aBody').innerHTML = S1A_QUEUE.map((item, i) => {
    const emailTag = item.createdByEmail
      ? `<div style="font-size:0.72rem;color:var(--primary);margin-top:2px;"><i class="fas fa-envelope" style="font-size:0.65rem;"></i> ${escHtml(item.createdByEmail)}</div>`
      : '';
    return `<tr id="s1a-row-${i}">
      <td>
        <div class="sa-person">${avatarHtml(item.createdBy, i)}<div>
          <div class="sa-meet-title">${escHtml(item.createdBy)}</div>
          ${emailTag}
        </div></div>
      </td>
      <td><div class="sa-meet-title">${escHtml(item.title)}</div></td>
      <td>${escHtml(item.dates)}</td>
      <td>${escHtml(item.venue)}</td>
      <td id="s1a-act-${i}">
        <button class="sa-btn-approve" onclick="doApprove('s1a',${i})">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="doReject('s1a',${i})">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>`;
  }).join('');
  applyQueueSearch();
}

// ── Section 1B: Third-Party Meets ─────────────────────────────
function renderS1B() {
  setQueueCount('s1b', S1B_QUEUE.length);
  if (!S1B_QUEUE.length) {
    $('s1bBody').innerHTML = emptyRow('No organizer meets are waiting for approval.');
    return;
  }
  $('s1bBody').innerHTML = S1B_QUEUE.map((item, i) => {
    const payChip = item.payType === 'A'
      ? `<span class="pay-chip pay-chip-a"><i class="fas fa-credit-card"></i> Option A (Platform GW)</span>`
      : `<span class="pay-chip pay-chip-b"><i class="fas fa-file-excel"></i> Option B (No Gateway)</span>`;
    // The ₹5,000 software fee can't be paid online yet, so it never blocks approval
    const feeChip = item.payType === 'A'
      ? `<span class="sa-fee-chip fee-na">None (online payments)</span>`
      : `<span class="sa-fee-chip fee-pending" title="Online payment of this fee is coming soon"><i class="fas fa-clock"></i> ₹5,000 not paid online</span>`;
    const canApprove = true;
    const emailTag = item.createdByEmail
      ? `<div style="font-size:0.72rem;color:var(--primary);margin-top:2px;"><i class="fas fa-envelope" style="font-size:0.65rem;"></i> ${escHtml(item.createdByEmail)}</div>`
      : '';
    return `<tr id="s1b-row-${i}">
      <td>
        <div class="sa-person">${avatarHtml(item.organizer, i)}<div>
          <div class="sa-meet-title">${escHtml(item.organizer)}</div>
          ${emailTag}
        </div></div>
      </td>
      <td><div class="sa-meet-title">${escHtml(item.title)}</div></td>
      <td>${payChip}</td>
      <td>${feeChip}</td>
      <td id="s1b-act-${i}">
        <button class="sa-btn-approve" ${!canApprove?'disabled title="Upfront fee not paid — cannot approve"':''} onclick="doApprove('s1b',${i})">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="doReject('s1b',${i})">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>`;
  }).join('');
  applyQueueSearch();
}

// ── Section 2: Academy & Coach Verification ───────────────────
function renderS2() {
  setQueueCount('s2', S2_QUEUE.length);
  if (!S2_QUEUE.length) {
    $('s2Body').innerHTML = emptyRow('No swimmers, academies, coaches or organizers are waiting for verification.');
    return;
  }
  $('s2Body').innerHTML = S2_QUEUE.map((item, i) => {
    const entityBadge = item.entityType === 'SWIMMER'
      ? `<span class="entity-badge" style="background:#e0e7ff;color:#3730a3;"><i class="fas fa-swimmer"></i> Swimmer Profile</span>`
      : item.entityType === 'ACADEMY'
        ? `<span class="entity-badge entity-academy"><i class="fas fa-building"></i> Academy</span>`
        : item.entityType === 'ORGANIZER'
          ? `<span class="entity-badge entity-academy"><i class="fas fa-user-tie"></i> Organizer</span>`
          : `<span class="entity-badge entity-coach"><i class="fas fa-chalkboard-teacher"></i> Coach</span>`;
    const submissionLabel = item.entityType === 'SWIMMER' ? 'Swimmer registration'
      : item.entityType === 'ACADEMY' ? 'Academy submission'
        : item.entityType === 'ORGANIZER' ? 'Organizer signup' : 'Coach submission';
    const emailTag = item.email
      ? `<div style="font-size:0.72rem;color:var(--primary);margin-top:2px;"><i class="fas fa-envelope" style="font-size:0.65rem;"></i> ${escHtml(item.email)}</div>`
      : '';
    return `<tr id="s2-row-${i}">
      <td>
        ${escHtml(submissionLabel)}
        ${emailTag}
      </td>
      <td>${entityBadge}</td>
      <td>
        <div class="sa-person">${avatarHtml(item.name, i)}<div>
          <div class="sa-meet-title">${escHtml(item.name)}</div>
          <div class="sa-meet-sub">${escHtml(item.detail)}</div>
        </div></div>
      </td>
      <td style="font-family:monospace;font-size:0.78rem;">
        ${escHtml(item.credentialId)}
        ${item.documentUrl
          ? `<a href="${escHtml(item.documentUrl)}" target="_blank" rel="noopener" class="sa-doc-link"><i class="fas fa-file-alt"></i> View Document</a>`
          : `<span class="sa-doc-none"><i class="fas fa-file-circle-xmark"></i> No document</span>`}
      </td>
      <td id="s2-act-${i}">
        <button class="sa-btn-approve" onclick="doApprove('s2',${i})">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="doReject('s2',${i})">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>`;
  }).join('');
  applyQueueSearch();
}

// ── Approve / Reject actions (write to Supabase) ──────────────
function queueItem(section, idx) {
  if (section === 's1a') return S1A_QUEUE[idx];
  if (section === 's1b') return S1B_QUEUE[idx];
  return S2_QUEUE[idx];
}

async function writeAudit(actionType, entity, entityId, notes) {
  if (!window.sb) return;
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  try {
    await window.sb.from('system_audit_logs').insert({
      admin_id: session ? session.userId : null,
      action_type: actionType,
      target_entity: entity,
      target_entity_id: String(entityId),
      notes,
    });
  } catch (e) { console.warn('[SwimFest] audit log:', e.message); }
}

window.doApprove = async function(section, idx) {
  const item = queueItem(section, idx);
  if (!item) return;
  const actEl = $(`${section}-act-${idx}`);
  const name = item.title || item.name;

  let ok = false;
  if (section === 's1a' || section === 's1b') {
    const { error } = await SwimReason.update('tournaments', 'tournament_id', item.id, { status: 'PUBLISHED', rejection_notes: null });
    ok = !error;
    if (ok) await writeAudit('EVENT_APPROVED', 'TOURNAMENT', item.id, `Approved & published: ${name}`);
    if (error) console.error('[SwimFest] approve meet:', error.message);
  } else {
    const { error } = await SwimReason.update(item.table, item.idCol, item.id, { status: 'APPROVED_ACTIVE', rejection_notes: null });
    ok = !error;
    if (ok) await writeAudit(item.entityType + '_VERIFIED', item.entityType, item.id, `Verified: ${name}`);
    if (error) console.error('[SwimFest] approve entity:', error.message);
  }

  if (!ok) { showToast('Approve failed — check permissions.', 'warn'); return; }
  actEl.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Approved</span>`;
  showToast(`Approved: ${name}`, 'success');
  recountBadge(section);
  loadTurnaround();
};

window.doReject = async function(section, idx) {
  const item = queueItem(section, idx);
  if (!item) return;
  const actEl = $(`${section}-act-${idx}`);
  const name = item.title || item.name;
  const isMeet = section === 's1a' || section === 's1b';

  // A reason is required: it's shown to whoever submitted it
  const reason = await SwimReason.ask({
    title: isMeet ? 'Send this meet back' : 'Reject this submission',
    subject: name,
    action: isMeet ? 'Send back' : 'Reject',
  });
  if (!reason) return;

  const { error } = isMeet
    ? await SwimReason.update('tournaments', 'tournament_id', item.id, { status: 'REJECTED_DRAFT', rejection_notes: reason })
    : await SwimReason.update(item.table, item.idCol, item.id, { status: 'REJECTED', rejection_notes: reason });
  if (error) { console.error('[SwimFest] reject:', error.message); showToast('Reject failed: ' + error.message, 'warn'); return; }
  await writeAudit(isMeet ? 'EVENT_REJECTED' : item.entityType + '_REJECTED', isMeet ? 'TOURNAMENT' : item.entityType, item.id,
    `Rejected: ${name}
Reason: ${reason}`);
  if (isMeet) loadTournaments();   // it moves to Sent back
  actEl.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Rejected</span>`;
  showToast(`Rejected: ${name} — Returned to submitter.`, 'warn');
  recountBadge(section);
  loadTurnaround();
};

function recountBadge(section) {
  // Rows still showing a Reject button are still pending
  const pending = document.querySelectorAll(`[id^="${section}-act-"] button.sa-btn-reject`).length;
  setQueueCount(section, pending);
}

// ── Export Audit Log ──────────────────────────────────────────
window.exportAuditLog = async function() {
  if (!window.sb) { showToast('DB not connected.', 'warn'); return; }
  const { data, error } = await window.sb
    .from('system_audit_logs')
    .select('log_id, admin_id, action_type, target_entity, target_entity_id, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) { console.error('[SwimFest] audit export:', error.message); showToast('Export failed: ' + error.message, 'warn'); return; }
  if (!data || !data.length) { showToast('No audit log entries yet.', 'info'); return; }

  const header = ['log_id','admin_id','action_type','target_entity','target_entity_id','notes','created_at'];
  const rows = data.map(r => header.map(k => r[k]));
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SwimFest_SystemAuditLog.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('System audit log exported as CSV.', 'success');
};

// ── Emergency Notice ──────────────────────────────────────────
window.openNoticeModal = function() {
  updateNoticePreview();
  openModal('noticeModal');
};

function updateNoticePreview() {
  const title = $('noticeTitle')?.value || '';
  const msg   = $('noticeMsg')?.value  || '';
  const el = $('noticePreviewText');
  if (el) el.textContent = title ? `⚠️ ${title}: ${msg}` : 'Preview will appear here…';
}

window.publishNotice = async function() {
  const title  = $('noticeTitle').value.trim();
  const msg    = $('noticeMsg').value.trim();
  const expiry = parseInt($('noticeExpiry').value, 10) || 12;
  const active = $('noticeActive').value === 'true';
  if (!title || !msg) { showToast('Title and message are required.','warn'); return; }

  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  const expiredAt = new Date(Date.now() + expiry * 3600 * 1000).toISOString();

  if (window.sb) {
    const { error } = await window.sb.from('emergency_notices').insert({
      title, message: msg, is_active: active,
      created_by: session ? session.userId : null,
      expired_at: expiredAt,
    });
    if (error) { console.error('[SwimFest] notice:', error.message); showToast('Publish failed: ' + error.message, 'warn'); return; }
    await writeAudit('EMERGENCY_NOTICE', 'NOTICE', title, `Published notice: ${title}`);
  }

  closeModal('noticeModal');
  showToast(`Emergency notice published · Expires in ${expiry}h`, 'success');
  if (active) showEmergencyBanner(title, msg);
};

function showEmergencyBanner(title, msg) {
  const existing = document.getElementById('emergencyBanner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'emergencyBanner';
  banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:10001;
    background:var(--danger);color:var(--white);padding:10px 24px;
    font-size:0.85rem;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:16px;
    box-shadow:0 4px 16px rgba(231,76,60,0.4);`;
  banner.innerHTML = `
    <span><i class="fas fa-exclamation-triangle"></i> &nbsp;${escHtml(title)}: ${escHtml(msg)}</span>
    <button onclick="document.getElementById('emergencyBanner').remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:1rem;padding:0 4px;">×</button>`;
  document.body.appendChild(banner);
}

// ── All Tournaments / Meets Directory ─────────────────────────
let ALL_MEETS = [];
let ALL_MEETS_FILTER = 'ALL';
let ALL_MEETS_SEARCH = '';
let ALL_MEETS_STATE = '';
let ALL_MEETS_CITY = '';

// State and city dropdowns, built from the meets themselves.
// Picking a state narrows the city list to that state's cities.
function fillPlaceFilters() {
  const stateSel = $('allMeetsState'), citySel = $('allMeetsCity');
  if (!stateSel || !citySel) return;
  const clean = v => String(v || '').trim();
  const sortU = list => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const opt = (v, label, n) => `<option value="${escHtml(v)}">${escHtml(label)}${n != null ? ` (${n})` : ''}</option>`;
  const count = (key, v) => ALL_MEETS.filter(t => clean(t[key]) === v).length;

  const states = sortU(ALL_MEETS.map(t => clean(t.state)));
  if (ALL_MEETS_STATE && !states.includes(ALL_MEETS_STATE)) ALL_MEETS_STATE = '';
  stateSel.innerHTML = opt('', 'All states') + states.map(s => opt(s, s, count('state', s))).join('');
  stateSel.value = ALL_MEETS_STATE;

  const inState = ALL_MEETS.filter(t => !ALL_MEETS_STATE || clean(t.state) === ALL_MEETS_STATE);
  const cities = sortU(inState.map(t => clean(t.city)));
  if (ALL_MEETS_CITY && !cities.includes(ALL_MEETS_CITY)) ALL_MEETS_CITY = '';
  citySel.innerHTML = opt('', ALL_MEETS_STATE ? `All cities in ${ALL_MEETS_STATE}` : 'All cities')
    + cities.map(c => opt(c, c, inState.filter(t => clean(t.city) === c).length)).join('');
  citySel.value = ALL_MEETS_CITY;
}

function initPlaceFilters() {
  const stateSel = $('allMeetsState'), citySel = $('allMeetsCity');
  if (!stateSel || !citySel) return;
  stateSel.addEventListener('change', () => { ALL_MEETS_STATE = stateSel.value; ALL_MEETS_CITY = ''; fillPlaceFilters(); renderAllMeets(); });
  citySel.addEventListener('change', () => { ALL_MEETS_CITY = citySel.value; renderAllMeets(); });
}
document.addEventListener('DOMContentLoaded', initPlaceFilters);

// Total race entries across all meets (the All meets headline number)
async function loadEntryTotal() {
  const badge = $('allMeetsEntriesBadge');
  if (!window.sb || !badge) return;
  const { count, error } = await window.sb.from('event_entries').select('entry_id', { count: 'exact', head: true });
  if (!error) badge.textContent = `${(count ?? 0).toLocaleString('en-IN')} race entr${count === 1 ? 'y' : 'ies'}`;
}

// One request for every meet; the All meets tab, the meet approval
// queues and the meet numbers are all built from it.
async function loadTournaments() {
  if (!window.sb) {
    setQueueCount('s1a', 0, '!');
    setQueueCount('s1b', 0, '!');
    return;
  }
  try {
    const { data, error } = await window.sb
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) {
      console.error('[SwimFest] meets:', error.message);
      renderS1A();
      renderS1B();
      return;
    }
    ALL_MEETS = data || [];
    renderAllMeets();
    renderMeetMetrics();
    await buildMeetQueues();
  } catch (e) {
    console.error('[SwimFest] meets exception:', e);
  }
}

window.handleMeetsSearch = function(val) {
  ALL_MEETS_SEARCH = (val || '').trim();
  renderAllMeets();
};

window.filterMeetsByStatus = function(status, btn) {
  ALL_MEETS_FILTER = status;
  document.querySelectorAll('#meetsStatusFilters .sa-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAllMeets();
};

window.openAllMeetSites = function(title, tid) {
  const encTitle = encodeURIComponent(title);
  window.open(`event.html?id=${encodeURIComponent(tid)}`, '_blank');
  window.open(`admin.html?t=${encTitle}`, '_blank');
  window.open(`results.html`, '_blank');
  window.open(`heatsheets.html?tournament=${encTitle}`, '_blank');
  showToast(`Opening all sites/portals for: ${title}`, 'success');
};

// Organizer asked to close a finished meet → mark it COMPLETED (read-only)
window.approveClosure = async function(tid, title) {
  if (!window.sb) return;
  const { error } = await window.sb.from('tournaments')
    .update({ status: 'COMPLETED' }).eq('tournament_id', tid);
  if (error) {
    showToast('Closure failed: ' + error.message, 'warn');
    return;
  }
  await writeAudit('MEET_CLOSED', 'TOURNAMENT', tid, `Closure approved: ${title}`);
  showToast(`Meet closed: ${title}`, 'success');
  loadTournaments();
};

window.approveMeetDirect = async function(tid, title) {
  if (!window.sb) return;
  const { error } = await SwimReason.update('tournaments', 'tournament_id', tid, { status: 'PUBLISHED', rejection_notes: null });
  if (error) {
    showToast('Approve failed: ' + error.message, 'warn');
    return;
  }
  await writeAudit('EVENT_APPROVED', 'TOURNAMENT', tid, `Approved & published from All Meets directory: ${title}`);
  showToast(`Meet Approved & Published: ${title}`, 'success');
  loadTournaments();
};

function renderAllMeets() {
  const badge = $('allMeetsCountBadge');
  const body  = $('allMeetsBody');
  if (badge) badge.textContent = `${ALL_MEETS.length} Total Meets`;
  if (!body) return;
  fillPlaceFilters();

  let filtered = ALL_MEETS;
  if (ALL_MEETS_STATE) filtered = filtered.filter(t => String(t.state || '').trim() === ALL_MEETS_STATE);
  if (ALL_MEETS_CITY)  filtered = filtered.filter(t => String(t.city || '').trim() === ALL_MEETS_CITY);
  if (ALL_MEETS_FILTER !== 'ALL') {
    if (ALL_MEETS_FILTER === 'DRAFT') {
      filtered = filtered.filter(t => t.status === 'DRAFT' || t.status === 'REJECTED_DRAFT');
    } else {
      filtered = filtered.filter(t => t.status === ALL_MEETS_FILTER);
    }
  }

  if (ALL_MEETS_SEARCH) {
    const q = ALL_MEETS_SEARCH.toLowerCase();
    filtered = filtered.filter(t => 
      (t.title || '').toLowerCase().includes(q) ||
      (t.host_organization || '').toLowerCase().includes(q) ||
      (t.city || '').toLowerCase().includes(q) ||
      (t.venue_name || '').toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--gray);">
      <i class="fas fa-search" style="font-size:1.5rem;opacity:0.4;margin-bottom:8px;display:block;"></i>
      No meets found matching filter.
    </td></tr>`;
    return;
  }

  body.innerHTML = filtered.map(t => {
    const encTitle = encodeURIComponent(t.title || '');
    const tid = encodeURIComponent(t.tournament_id || '');
    const statusMap = {
      PUBLISHED:        { cls: 'chip-published', label: 'Published (Live)' },
      LOCKED:           { cls: 'chip-published', label: 'Locked (Roster Set)' },
      COMPLETED:        { cls: 'chip-completed', label: 'Completed' },
      PENDING_APPROVAL: { cls: 'chip-pending',   label: 'Pending Approval' },
      CLOSURE_REQUESTED:{ cls: 'chip-pending',   label: 'Closure Requested' },
      REJECTED_DRAFT:   { cls: 'chip-draft',     label: 'Rejected' },
      DRAFT:            { cls: 'chip-draft',     label: 'Draft' },
    };
    const sc = statusMap[t.status] || { cls: 'chip-draft', label: t.status };
    const dateRange = fmtDateRange(t.start_date, t.end_date);
    const regClose = t.registration_deadline ? new Date(t.registration_deadline).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '—';
    const isPending = t.status === 'PENDING_APPROVAL';
    const isClosureRequested = t.status === 'CLOSURE_REQUESTED';

    return `
      <tr>
        <td>
          <a href="event.html?id=${encodeURIComponent(t.tournament_id)}" target="_blank" class="sa-meet-title" style="color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
            ${escHtml(t.title)} <i class="fas fa-external-link-alt" style="font-size:0.65rem;color:var(--gray);"></i>
          </a>
          <div class="sa-meet-sub">
            <span class="sa-cat-pill" style="font-size:0.65rem;">${escHtml(t.state || 'India')}</span>
            <span>Fee: ₹${t.reg_fee_amount || 0}</span>
            <span>·</span>
            <span>Pool: ${escHtml(t.pool_length || '50m')} (${t.lane_count || 8} Lanes)</span>
          </div>
        </td>
        <td>
          <div style="font-weight:700;font-size:0.83rem;">${escHtml(t.host_organization || '—')}</div>
          ${t.created_by_email ? `<div style="font-size:0.72rem;color:var(--primary);margin-top:1px;"><i class="fas fa-envelope" style="font-size:0.65rem;"></i> ${escHtml(t.created_by_email)}</div>` : ''}
          <div style="font-size:0.72rem;color:var(--gray);margin-top:2px;">
            <i class="fas fa-map-marker-alt" style="color:var(--danger);font-size:0.65rem;"></i>
            ${escHtml(t.venue_name || '')}${t.city ? ', ' + escHtml(t.city) : ''}
          </div>
        </td>
        <td>
          <div style="font-weight:700;font-size:0.8rem;">${dateRange}</div>
          <div style="font-size:0.7rem;color:var(--gray);margin-top:2px;">Reg closes: ${regClose}</div>
        </td>
        <td>
          <span class="em-status-chip ${sc.cls}">
            <span class="status-dot"></span> ${sc.label}
          </span>
        </td>
        <td>
          <div class="em-action-group">
            <a href="event.html?id=${encodeURIComponent(t.tournament_id)}" target="_blank" class="em-action-btn em-btn-view" title="Open Public Event Page">
              <i class="fas fa-globe"></i> Public Site
            </a>
            <a href="admin.html?t=${encTitle}" target="_blank" class="em-action-btn em-btn-manage" title="Master Player List / Roster">
              <i class="fas fa-users"></i> Roster
            </a>
            <a href="heatgen.html" target="_blank" class="em-action-btn em-btn-race" title="Heat Generation">
              <i class="fas fa-bolt"></i> Heat Gen
            </a>
            <a href="results.html" target="_blank" class="em-action-btn em-btn-race" title="Live Results">
              <i class="fas fa-broadcast-tower"></i> Results
            </a>
            <a href="heatsheets.html?tournament=${encTitle}" target="_blank" class="em-action-btn em-btn-view" title="Heat Sheets & Schedule">
              <i class="fas fa-file-alt"></i> Sheets
            </a>
            <a href="orgracecontrol.html" target="_blank" class="em-action-btn em-btn-manage" title="Poolside Race Control">
              <i class="fas fa-stopwatch"></i> Race Control
            </a>
            <a href="saoverride.html?id=${tid}" target="_blank" class="em-action-btn em-btn-edit" title="Universal Override">
              <i class="fas fa-unlock-alt"></i> Override
            </a>
            <button type="button" onclick="openAssignAdmins('${t.tournament_id}')" class="em-action-btn em-btn-manage" title="Choose which Admins run this meet">
              <i class="fas fa-user-gear"></i> Admins${ASSIGNED[t.tournament_id] ? ` (${ASSIGNED[t.tournament_id].length})` : ''}
            </button>
            <button onclick="openAllMeetSites('${escHtml(t.title.replace(/'/g, "\\'"))}', '${t.tournament_id}')" class="em-action-btn em-btn-all-sites" title="Open all associated pages for this meet in new tabs">
              <i class="fas fa-external-link-square-alt"></i> Open All Sites
            </button>
            ${isPending ? `
              <button class="sa-btn-approve" onclick="approveMeetDirect('${tid}', '${escHtml(t.title.replace(/'/g, "\\'"))}')" style="padding:4px 10px;font-size:0.7rem;"><i class="fas fa-check"></i> Approve</button>
            ` : ''}
            ${isClosureRequested ? `
              <button class="sa-btn-approve" onclick="approveClosure('${tid}', '${escHtml(t.title.replace(/'/g, "\\'"))}')" style="padding:4px 10px;font-size:0.7rem;"><i class="fas fa-flag-checkered"></i> Approve closure</button>
            ` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
  applyQueueSearch();
}

// ── Sidebar navigation (tabs + approval queues) ──────────────
const VALID_TABS = ['dashboard', 'meets', 'academies', 'financials', 'team'];

// `sub` is shown under the tabs; it also becomes each tab's hover tooltip (see initTabs)
const QUEUE_META = {
  s2:       { title: 'Swimmers, academies, coaches & organizers', sub: 'New sign-ups waiting to be verified. Approve once their details and documents check out.' },
  s1a:      { title: 'Internal meets', sub: 'Meets created by SwimFest Admins. No software fee. Approving publishes the meet.' },
  s1b:      { title: 'Third-party meets', sub: 'External clubs and hosts running their own meet on SwimFest under a paid software licence (₹5,000 when they collect entry fees offline). Approving publishes the meet.' },
  reopen:   { title: 'Reopen requests', sub: 'Organizers asking to reopen a finished meet after the event, usually to fix a disputed result.' },
  sentback: { title: 'Sent back', sub: 'Meets you returned to their organizer, with the reason. They move back to Internal or Third-party meets when resubmitted.' },
};
let ACTIVE_QUEUE = 's2';

// Tool pages open inside this console (iframe), at superadmin.html#<key>.
// Academy directory and Admin console are full pages of their own, so they're not listed.
const TOOLS = {
  playerlist:   { page: 'playerlist.html',     title: 'Master player list' },
  heatgen:      { page: 'heatgen.html',        title: 'Heat generation' },
  racecontrol:  { page: 'orgracecontrol.html', title: 'Race control' },
  results:      { page: 'results.html',        title: 'Live results' },
  createmeet:   { page: 'orgcreate.html',      title: 'Create meet' },
  organizer:    { page: 'orgdashboard.html',   title: 'Organizer dashboard' },
  override:     { page: 'saoverride.html',     title: 'Universal override' },
};
const TOOL_BY_PAGE = Object.fromEntries(Object.entries(TOOLS).map(([k, t]) => [t.page, k]));
window.SA_TOOL_PAGES = TOOL_BY_PAGE;      // read by embed.js inside the frame
window.SA_CONSOLE_PAGE = 'superadmin.html';

// New history entry per section so Back works; the first visit just fills in the hash
function setHash(key) {
  if (location.hash === '#' + key) return;
  if (location.hash) history.pushState(null, '', '#' + key);
  else history.replaceState(null, '', '#' + key);
}

// Show a tool in the frame. `src` keeps any ?t=… or #… the link carried.
function openTool(key, src) {
  const tool = TOOLS[key];
  if (!tool) return switchTab('dashboard');
  const frame = $('saToolFrame');
  const url = new URL(src || tool.page, location.href);
  url.searchParams.set('embed', '1');
  const current = frame.contentWindow && frame.src ? frame.src : '';
  if (current !== url.href) frame.src = url.href;

  $('saContainer').hidden = true;
  $('saTool').hidden = false;
  document.querySelectorAll('.sa-nav-tab[data-tab]').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sa-side-sub [data-queue]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sa-side-link[data-tool]').forEach(a => a.classList.toggle('active', a.dataset.tool === key));
  document.title = `${tool.title} — SwimFest Super Admin`;
  setHash(key);
  try { localStorage.setItem('swimfest_sa_return', 'superadmin.html#' + key); } catch (_) {}
}
window.openTool = openTool;

// Called by embed.js when a link inside the frame leads to a tool or a console tab
window.openToolFromFrame = function (href) {
  const u = new URL(href, location.href);
  const page = u.pathname.split('/').pop();
  if (page === 'superadmin.html') {
    const key = u.hash.replace('#', '');
    if (TOOLS[key]) return openTool(key);
    return switchTab(key);
  }
  if (TOOL_BY_PAGE[page]) openTool(TOOL_BY_PAGE[page], u.href);
};

function switchTab(tabKey) {
  if (TOOLS[tabKey]) return openTool(tabKey);
  if (!VALID_TABS.includes(tabKey)) tabKey = 'dashboard';
  $('saContainer').hidden = false;
  $('saTool').hidden = true;
  document.querySelectorAll('.sa-side-link[data-tool]').forEach(a => a.classList.remove('active'));
  document.title = 'Super Admin Console — SwimFest';

  document.querySelectorAll('.sa-nav-tab[data-tab]').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabKey);
  });

  let title = 'Approvals';
  document.querySelectorAll('.sa-tab-panel').forEach(panel => {
    const on = panel.getAttribute('data-tab-panel') === tabKey;
    panel.classList.toggle('active', on);
    panel.style.display = on ? 'block' : 'none';
    if (on) title = panel.getAttribute('data-title') || title;
  });
  const titleEl = $('saPageTitle');
  if (titleEl) titleEl.textContent = title;

  // The four number boxes belong to Approvals only
  $('saKpis').hidden = tabKey !== 'dashboard';
  // Team is about people, not meets: no Emergency notice / Create meet buttons there
  document.querySelector('.sa-head-actions').hidden = tabKey === 'team';
  if (tabKey === 'team') loadTeam();

  // Header buttons follow the tab: academies get Add academy / Add coach, the rest Create meet
  document.querySelectorAll('[data-head-for]').forEach(b => {
    b.hidden = b.dataset.headFor !== (tabKey === 'academies' ? 'academies' : 'other');
  });

  if (tabKey === 'dashboard') {
    switchQueue(ACTIVE_QUEUE);
  } else {
    document.querySelectorAll('.sa-side-sub [data-queue]').forEach(b => b.classList.remove('active'));
  }

  setHash(tabKey);
  // Remembered so Back on other pages returns to this section (see auth.js)
  try { localStorage.setItem('swimfest_sa_return', 'superadmin.html#' + tabKey); } catch (_) {}
}
window.switchTab = switchTab;

function switchQueue(key) {
  if (!QUEUE_META[key]) key = 's2';
  ACTIVE_QUEUE = key;
  document.querySelectorAll('.sa-qtab[data-queue]').forEach(t => {
    const on = t.getAttribute('data-queue') === key;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.sa-side-sub [data-queue]').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-queue') === key);
  });
  document.querySelectorAll('.sa-qpanel').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-qpanel') === key);
  });
  $('saQueueTitle').textContent = QUEUE_META[key].title;
  $('saQueueSub').textContent = QUEUE_META[key].sub;
  applyQueueSearch();
}
window.switchQueue = switchQueue;

// Client-side text filter over the rows of the visible queue
function applyQueueSearch() {
  const input = $('saQueueSearch');
  const q = (input ? input.value : '').trim().toLowerCase();
  const panel = document.querySelector(`.sa-qpanel[data-qpanel="${ACTIVE_QUEUE}"]`);
  if (!panel) return;
  panel.querySelectorAll('tbody tr').forEach(tr => {
    if (tr.querySelector('.sa-empty-cell')) return;
    tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// Mobile: sidebar slides in as a drawer
function setNavOpen(open) {
  $('saShell').classList.toggle('nav-open', open);
  const btn = $('saMenuBtn');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function initTabs() {
  // Every queue tab explains itself on hover
  document.querySelectorAll('[data-queue]').forEach(el => {
    const meta = QUEUE_META[el.getAttribute('data-queue')];
    if (meta) el.title = meta.sub;
  });

  document.querySelectorAll('.sa-nav-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      switchTab(this.getAttribute('data-tab'));
      setNavOpen(false);
    });
  });

  document.querySelectorAll('[data-queue]').forEach(el => {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      ACTIVE_QUEUE = this.getAttribute('data-queue');
      switchTab('dashboard');
      setNavOpen(false);
    });
  });

  const search = $('saQueueSearch');
  if (search) search.addEventListener('input', applyQueueSearch);

  const menuBtn = $('saMenuBtn');
  if (menuBtn) menuBtn.addEventListener('click', () => setNavOpen(!$('saShell').classList.contains('nav-open')));
  const scrim = $('saScrim');
  if (scrim) scrim.addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setNavOpen(false); });

  // Tool links open inside the console; Ctrl/Cmd-click still opens the page in a new tab
  document.querySelectorAll('a[data-tool]').forEach(a => {
    a.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openTool(a.dataset.tool, a.getAttribute('href'));
      setNavOpen(false);
    });
  });

  // Inside the frame the address can change (e.g. heat generation → race control)
  $('saToolFrame').addEventListener('load', () => {
    let w;
    try { w = $('saToolFrame').contentWindow.location; } catch (_) { return; }
    const page = w.pathname.split('/').pop();
    if (page === 'login.html') { location.href = w.href.replace(/[?&]embed=1/, ''); return; }
    const key = TOOL_BY_PAGE[page];
    if (key && location.hash !== '#' + key) {
      history.replaceState(null, '', '#' + key);
      document.querySelectorAll('.sa-side-link[data-tool]').forEach(a => a.classList.toggle('active', a.dataset.tool === key));
    }
  });

  // Browser Back / Forward moves between console sections and tools
  window.addEventListener('popstate', () => switchTab((location.hash || '').replace('#', '') || 'dashboard'));

  switchTab((location.hash || '').replace('#', '') || 'dashboard');
}

// Signed-in user in the sidebar footer
function renderSidebarUser() {
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (!session) return;
  const name = session.name || 'Super Admin';
  $('saUserName').textContent = name;
  $('saUserEmail').textContent = session.email || '';
  $('saUserInitials').textContent = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA';
  // Role matrix: Master Owner or Co-Super Admin
  if (window.SwimGov) SwimGov.isOwner().then(owner => {
    IS_OWNER = owner !== false;
    $('saUserEmail').textContent = `${IS_OWNER ? 'Owner' : 'Co-Super Admin'}${session.email ? ' · ' + session.email : ''}`;
    // Only the Owner manages the team
    $('saTeamNav').hidden = !IS_OWNER;
    if (!IS_OWNER && location.hash === '#team') switchTab('dashboard');
  });
}
let IS_OWNER = true;

// Live preview for notice modal
document.addEventListener('input', e => {
  if (['noticeTitle','noticeMsg'].includes(e.target.id)) updateNoticePreview();
});

// ── Toast styles ──────────────────────────────────────────────
(function(){
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast{position:fixed;bottom:28px;right:28px;z-index:99999;
      padding:12px 20px;background:var(--dark);color:var(--white);
      border-radius:var(--radius-sm);font-size:0.85rem;font-weight:500;
      display:flex;align-items:center;gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);transform:translateY(20px);opacity:0;
      transition:all 0.3s ease;max-width:420px;font-family:'Inter',sans-serif;}
    .admin-toast.show{transform:translateY(0);opacity:1;}
    .admin-toast i{color:var(--accent);}
    .admin-toast.admin-toast-success i{color:var(--success);}
    .admin-toast.admin-toast-warn i{color:var(--warning);}
    .sa-doc-link{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 10px;
      border-radius:6px;background:#eef4ff;color:var(--primary);font-family:'Inter',sans-serif;
      font-size:0.72rem;font-weight:700;text-decoration:none;}
    .sa-doc-link:hover{background:var(--primary);color:#fff;}
    .sa-doc-none{display:inline-flex;align-items:center;gap:5px;margin-top:6px;
      font-family:'Inter',sans-serif;font-size:0.72rem;color:var(--gray);font-style:italic;}`;
  document.head.appendChild(s);
})();

// ── Bootstrap ─────────────────────────────────────────────────
// Which data each table feeds, so a change reloads only what it affects
const LOADERS = {
  tournaments:     [loadTournaments],
  bookings:        [loadMetrics],
  swimmers:        [loadVerificationQueue, loadPeopleMetrics],
  academies:       [loadVerificationQueue, loadPeopleMetrics],
  coaches:         [loadVerificationQueue],
  organizers:      [loadVerificationQueue],
  reopen_requests: [loadReopenQueue],
  event_entries:   [loadEntryTotal],
};
const ALL_LOADERS = [loadTournaments, loadMetrics, loadPeopleMetrics, loadVerificationQueue, loadReopenQueue, loadTurnaround, loadEntryTotal];

function refreshLiveData(loaders = ALL_LOADERS) {
  // Skip while a modal is open so an in-progress action isn't disrupted
  if (document.querySelector('.modal-overlay.active')) return;
  new Set(loaders).forEach(load => load());
}

// Realtime: when a watched table changes, reload just what it feeds.
// Bursts of changes (e.g. a bulk insert) are collapsed into one refresh.
let realtimeLive = false;
let pendingTables = new Set();
let realtimeTimer = null;
function subscribeRealtime() {
  if (!window.sb || !window.sb.channel) return;
  const channel = window.sb.channel('superadmin-live');
  Object.keys(LOADERS).forEach(table => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      pendingTables.add(table);
      clearTimeout(realtimeTimer);
      realtimeTimer = setTimeout(() => {
        const loaders = [...pendingTables].flatMap(t => LOADERS[t]);
        pendingTables = new Set();
        refreshLiveData(loaders);
      }, 1000);
    });
  });
  channel.subscribe(status => {
    const wasLive = realtimeLive;
    realtimeLive = status === 'SUBSCRIBED';
    console.log('[SwimFest] realtime:', status);
    if (realtimeLive && !wasLive && lastRefresh) refreshLiveData();   // reconnected: catch up once
  });
}

// Fallback only: refresh every 2 minutes while realtime isn't connected
const FALLBACK_MS = 2 * 60 * 1000;
const STALE_AFTER_MS = 2 * 60 * 1000;
let lastRefresh = 0;
let hiddenSince = 0;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderSidebarUser();
  subscribeRealtime();
  refreshLiveData();
  lastRefresh = Date.now();
  setInterval(() => {
    if (document.hidden || realtimeLive) return;
    refreshLiveData();
    lastRefresh = Date.now();
  }, FALLBACK_MS);
  // Back on the tab after a while (realtime may have paused): catch up once
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenSince = Date.now(); return; }
    if (hiddenSince && Date.now() - hiddenSince > STALE_AFTER_MS) {
      refreshLiveData();
      lastRefresh = Date.now();
    }
  });
});

// ── Assign Admins to meets (role matrix: Admins run assigned meets only) ──
let ASSIGNED = {};        // tournament id → [admin ids]
let ADMIN_USERS = null;   // event_manager profiles

async function loadAssignments() {
  if (!window.sb) return;
  const { data, error } = await window.sb.from('tournament_admins').select('tournament_id, admin_id');
  if (error) return;   // table not created yet (rbac_governance.sql)
  ASSIGNED = {};
  (data || []).forEach(r => { (ASSIGNED[r.tournament_id] = ASSIGNED[r.tournament_id] || []).push(r.admin_id); });
  renderAllMeets();
}

window.openAssignAdmins = async function (tid) {
  const meet = ALL_MEETS.find(t => t.tournament_id === tid);
  if (!meet) return;
  if (!ADMIN_USERS) {
    const { data } = await window.sb.from('profiles').select('id, full_name, role').eq('role', 'event_manager').order('full_name');
    ADMIN_USERS = data || [];
  }
  const chosen = new Set(ASSIGNED[tid] || []);
  const back = document.createElement('div');
  back.className = 'srn-back';
  back.innerHTML = `<div class="srn-box" role="dialog" aria-modal="true" aria-labelledby="asgTitle">
    <div class="srn-head" id="asgTitle">Admins for this meet</div>
    <div class="srn-sub"><b>${escHtml(meet.title)}</b><br>Ticked Admins can run its player list and heat generation. Super admins can always run every meet.</div>
    <div class="srn-body" style="max-height:18rem;overflow-y:auto;">
      ${ADMIN_USERS.length ? ADMIN_USERS.map(a => `<label style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f1f5f9;cursor:pointer;">
        <input type="checkbox" value="${a.id}" ${chosen.has(a.id) ? 'checked' : ''}> ${escHtml(a.full_name || 'Admin ' + a.id.slice(0, 6))}</label>`).join('')
        : '<p style="margin:0;color:#64748b;">No Admin accounts yet.</p>'}
    </div>
    <div class="srn-err" id="asgErr"></div>
    <div class="srn-foot"><button type="button" class="srn-cancel">Cancel</button><button type="button" class="srn-ok" style="background:#0077b6;border-color:#0077b6;">Save</button></div>
  </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelector('.srn-cancel').onclick = close;
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.querySelector('.srn-ok').onclick = async () => {
    const now = new Set([...back.querySelectorAll('input:checked')].map(i => i.value));
    const add = [...now].filter(id => !chosen.has(id)), remove = [...chosen].filter(id => !now.has(id));
    const session = window.SwimAuth.getSession() || {};
    let res = { error: null };
    if (add.length) res = await window.sb.from('tournament_admins').insert(add.map(admin_id => ({ tournament_id: tid, admin_id, assigned_by: session.userId })));
    if (!res.error && remove.length) res = await window.sb.from('tournament_admins').delete().eq('tournament_id', tid).in('admin_id', remove);
    if (res.error) {
      back.querySelector('#asgErr').textContent = /relation|schema cache/i.test(res.error.message)
        ? 'Assigning Admins needs the database update (backend/db/rbac_governance.sql).' : res.error.message;
      return;
    }
    const names = id => (ADMIN_USERS.find(a => a.id === id) || {}).full_name || id.slice(0, 6);
    await writeAudit('MEET_ADMINS_CHANGED', 'TOURNAMENT', tid,
      `${meet.title}${add.length ? `\nAssigned: ${add.map(names).join(', ')}` : ''}${remove.length ? `\nRemoved: ${remove.map(names).join(', ')}` : ''}`);
    close();
    showToast('Admins for this meet saved.', 'success');
    loadAssignments();
  };
};
document.addEventListener('DOMContentLoaded', () => setTimeout(loadAssignments, 1500));

// ── Team (Owner only): super admins and Admins ────────────────
// Uses team_list / team_find / team_set_role (backend/db/team_management.sql),
// which check in the database that the caller is the Owner.
const ROLE_LABEL = { owner: 'Owner', co: 'Co-Super Admin', admin: 'Admin' };
function teamRole(p) {
  if (p.role === 'super_admin') return p.is_master_owner ? 'owner' : 'co';
  if (p.role === 'event_manager') return 'admin';
  return 'other';
}
const roleChip = p => {
  const r = teamRole(p);
  const label = ROLE_LABEL[r] || (p.role === 'organizer' ? 'Organizer' : 'Swimmer / parent');
  return `<span class="tm-role ${r}">${label}</span>`;
};
const personCell = p => `<div class="sa-meet-title">${escHtml(p.full_name || '(no name)')}</div><div style="font-size:0.75rem;color:var(--gray);">${escHtml(p.email || '')}</div>`;

// Buttons for every role this person could move to
function roleButtons(p) {
  const me = (window.SwimAuth.getSession() || {}).userId;
  if (p.id === me) return '<span class="tm-you">This is you</span>';
  const now = teamRole(p);
  const opts = [['owner', 'Make Owner'], ['co_super_admin', 'Make Co-Super Admin'], ['admin', 'Make Admin']]
    .filter(([k]) => ({ owner: 'owner', co_super_admin: 'co', admin: 'admin' })[k] !== now);
  const btns = opts.map(([k, label]) => `<button type="button" class="tm-btn" data-role="${k}" data-user="${p.id}">${label}</button>`);
  if (now !== 'other') btns.push(`<button type="button" class="tm-btn danger" data-role="remove" data-user="${p.id}">Remove from team</button>`);
  return `<div class="tm-btns">${btns.join('')}</div>`;
}

const TEAM_PEOPLE = {};
async function loadTeam() {
  const body = $('teamBody');
  if (!window.sb || !body) return;
  const { data, error } = await window.sb.rpc('team_list');
  if (error) {
    body.innerHTML = `<tr><td colspan="3" class="sa-empty-cell">${/function|schema cache/i.test(error.message)
      ? 'The Team tab needs the database update: run backend/db/team_management.sql in Supabase.'
      : escHtml(error.message)}</td></tr>`;
    return;
  }
  (data || []).forEach(p => { TEAM_PEOPLE[p.id] = p; });
  $('teamCount').textContent = `${(data || []).length} people`;
  body.innerHTML = (data || []).map(p => `<tr><td>${personCell(p)}</td><td>${roleChip(p)}</td><td>${roleButtons(p)}</td></tr>`).join('')
    || '<tr><td colspan="3" class="sa-empty-cell">No team members yet.</td></tr>';
}

let teamFindTimer;
async function findPeople() {
  const q = $('teamSearch').value.trim();
  const body = $('teamFindBody');
  if (q.length < 2) { body.innerHTML = '<tr><td colspan="3" class="sa-empty-cell">Type a name or email above.</td></tr>'; return; }
  const { data, error } = await window.sb.rpc('team_find', { q });
  if (error) { body.innerHTML = `<tr><td colspan="3" class="sa-empty-cell">${escHtml(error.message)}</td></tr>`; return; }
  (data || []).forEach(p => { TEAM_PEOPLE[p.id] = p; });
  body.innerHTML = (data || []).map(p => `<tr><td>${personCell(p)}</td><td>${roleChip(p)}</td><td>${roleButtons(p)}</td></tr>`).join('')
    || '<tr><td colspan="3" class="sa-empty-cell">Nobody found. They need to sign up for a SwimFest account first.</td></tr>';
}

// Confirmation box. Removing someone, or making them an Owner, can't be done by a
// stray click: the button only works after typing the phrase (like the player list lock).
const TEAM_PHRASE = { remove: 'REMOVE', owner: 'MAKE OWNER' };
function confirmTeamChange(p, role) {
  const name = p.full_name || p.email || 'this person';
  const now = ROLE_LABEL[teamRole(p)] || 'Swimmer / parent';
  const copy = {
    remove: ['Remove from the team?', `<b>${escHtml(name)}</b> stops being ${escHtml(now)} straight away. They lose access to the console${teamRole(p) === 'admin' ? ' and are taken off every meet they run' : ''}.`],
    owner: ['Make this person an Owner?', `<b>${escHtml(name)}</b> gets full control of SwimFest, including this Team tab: they could change or remove anyone, even you.`],
    co_super_admin: ['Make this person a Co-Super Admin?', `<b>${escHtml(name)}</b> can approve, override and run every meet. Reopening a meet needs a written reason.`],
    admin: ['Make this person an Admin?', `<b>${escHtml(name)}</b> can run the meets you assign to them in All meets. They can't approve anything.`],
  }[role];
  const phrase = TEAM_PHRASE[role];
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'srn-back';
    back.innerHTML = `<div class="srn-box" role="dialog" aria-modal="true" aria-labelledby="tmcTitle">
      <div class="srn-head" id="tmcTitle">${copy[0]}</div>
      <div class="srn-sub">${copy[1]}<br><span style="font-size:0.78rem;">${escHtml(p.email || '')} · now ${escHtml(now)}. This is recorded in the audit log.</span></div>
      ${phrase ? `<div class="srn-body"><label for="tmcPhrase" style="font-size:0.85rem;">Type <b>${phrase}</b> to confirm:</label>
        <input id="tmcPhrase" autocomplete="off" spellcheck="false" placeholder="${phrase}"
          style="width:100%;box-sizing:border-box;margin-top:6px;height:2.5rem;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font:inherit;"></div>` : '<div class="srn-body"></div>'}
      <div class="srn-foot"><button type="button" class="srn-cancel">Cancel</button>
        <button type="button" class="srn-ok"${role === 'remove' || role === 'owner' ? '' : ' style="background:#0077b6;border-color:#0077b6;"'}>${role === 'remove' ? 'Remove' : 'Confirm'}</button></div>
    </div>`;
    document.body.appendChild(back);
    const ok = back.querySelector('.srn-ok'), input = back.querySelector('#tmcPhrase');
    const ready = () => !phrase || (input && input.value.trim().toUpperCase() === phrase);
    const sync = () => { ok.disabled = !ready(); ok.style.opacity = ready() ? '1' : '0.45'; ok.style.cursor = ready() ? 'pointer' : 'not-allowed'; };
    const done = v => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') done(false); };
    sync();
    if (input) { input.addEventListener('input', sync); input.focus(); } else ok.focus();
    document.addEventListener('keydown', onKey);
    back.querySelector('.srn-cancel').addEventListener('click', () => done(false));
    back.addEventListener('click', e => { if (e.target === back) done(false); });
    ok.addEventListener('click', () => { if (ready()) done(true); });
  });
}

async function changeRole(userId, role) {
  const p = TEAM_PEOPLE[userId] || {};
  const name = p.full_name || p.email || 'this person';
  const what = { owner: 'an Owner (full control, including the team)', co_super_admin: 'a Co-Super Admin', admin: 'an Admin', remove: 'removed from the team' }[role];
  if (!(await confirmTeamChange(p, role))) return;
  const { error } = await window.sb.rpc('team_set_role', { p_user: userId, p_role: role });
  if (error) { showToast(error.message, 'warn'); return; }
  showToast(role === 'remove' ? `${name} removed from the team` : `${name} is now ${what.split(' (')[0]}`, 'success');
  ADMIN_USERS = null;   // the Admins list for meet assignments changed
  await loadTeam();
  if ($('teamSearch').value.trim().length >= 2) findPeople();
}

document.addEventListener('DOMContentLoaded', () => {
  const search = $('teamSearch');
  if (search) search.addEventListener('input', () => { clearTimeout(teamFindTimer); teamFindTimer = setTimeout(findPeople, 300); });
  const panel = $('panel-team');
  if (panel) panel.addEventListener('click', e => {
    const b = e.target.closest('[data-role][data-user]');
    if (b) changeRole(b.dataset.user, b.dataset.role);
  });
});
