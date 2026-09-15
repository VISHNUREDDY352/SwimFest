/* ============================================================
   SwimFest — Super Admin Console JS   superadmin.js
   ============================================================ */
'use strict';

// Live data pulled from Supabase (see load* functions below)
let S1A_QUEUE = [];   // pending internal meets (Option A gateway)
let S1B_QUEUE = [];   // pending third-party meets (Option B gateway)
let S2_QUEUE  = [];   // pending academy / coach verifications

// ── Utilities ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

async function loadMetrics() {
  if (!window.sb) return;
  const cards = document.querySelectorAll('.sa-metric-value');
  // cards: [Active Meets, Total Athletes, Academies, Gross Revenue]
  try {
    const [meets, swimmers, acads, bookings] = await Promise.all([
      window.sb.from('tournaments').select('tournament_id', { count:'exact', head:true }).in('status', ['PUBLISHED','LOCKED']),
      window.sb.from('swimmer_directory').select('swimmer_id', { count:'exact', head:true }),
      window.sb.from('academies').select('academy_id', { count:'exact', head:true }),
      window.sb.from('bookings').select('total_amount'),
    ]);
    if (cards[0]) cards[0].textContent = meets.count ?? 0;
    if (cards[1]) cards[1].textContent = (swimmers.count ?? 0).toLocaleString('en-IN');
    if (cards[2]) cards[2].textContent = acads.count ?? 0;
    if (cards[3]) {
      const gross = (bookings.data || []).reduce((s, b) => s + Number(b.total_amount || 0), 0);
      cards[3].textContent = '₹' + gross.toLocaleString('en-IN');
    }
  } catch (e) { console.warn('[SwimFest] metrics:', e.message); }
}

// ── Supabase: pending meet queues ─────────────────────────────
async function loadMeetQueues() {
  if (!window.sb) {
    console.error('[SwimFest] window.sb is undefined — Supabase not initialized.');
    $('s1aBadge').textContent = 'DB not connected';
    $('s1bBadge').textContent = 'DB not connected';
    return;
  }
  const { data, error } = await window.sb
    .from('tournaments')
    .select('*')
    .eq('status', 'PENDING_APPROVAL')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[SwimFest] queues:', error.message);
    $('s1aBadge').textContent = '0 pending';
    $('s1bBadge').textContent = '0 pending';
    renderS1A();
    renderS1B();
    return;
  }
  console.info('[SwimFest] PENDING_APPROVAL tournaments found:', (data || []).length);

  const rows = data || [];
  // Split: Option A gateway → internal (1A); Option B → third-party (1B)
  S1A_QUEUE = rows.filter(t => t.gateway_option === 'OPTION_A_PLATFORM_GATEWAY').map(t => ({
    id: t.tournament_id, createdBy: t.host_organization || '—', title: t.title,
    createdByEmail: t.created_by_email || null,
    dates: fmtDateRange(t.start_date, t.end_date), venue: `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`,
  }));
  S1B_QUEUE = rows.filter(t => t.gateway_option !== 'OPTION_A_PLATFORM_GATEWAY').map(t => {
    const amt = t.platform_fee ?? t.registration_fee ?? null;
    return {
      id: t.tournament_id, organizer: t.host_organization || '—', title: t.title,
      createdByEmail: t.created_by_email || null,
      payType: 'B', feePaid: !!t.fee_paid, feeAmt: amt != null ? `₹${amt}` : '—',
    };
  });

  renderS1A();
  renderS1B();
}

// ── Supabase: pending academy / coach / swimmer verifications ─
async function loadVerificationQueue() {
  if (!window.sb) return;

  S2_QUEUE = [];

  // 1. Swimmers (fetch select(*) and filter status in JS to avoid HTTP 400 if status column is missing in DB)
  try {
    const swRes = await window.sb.from('swimmers').select('*');
    if (!swRes.error && swRes.data) {
      swRes.data
        .filter(s => s && s.status === 'PENDING_VERIFICATION')
        .forEach(s => S2_QUEUE.push({
          id: s.swimmer_id, table: 'swimmers', idCol: 'swimmer_id',
          entityType: 'SWIMMER', name: s.full_name, detail: `${s.gender || ''} ${s.category || ''} · Parent: ${s.parent_name || '—'} (${s.parent_phone || '—'}) ${s.school_name ? '· School: ' + s.school_name : ''}`,
          email: s.parent_email || null, credentialId: s.sfi_serial_no || `SWM-${String(s.swimmer_id).slice(0,8).toUpperCase()}`, documentUrl: null,
        }));
    }
  } catch (e) { console.warn('[SwimFest] swimmers queue query:', e.message); }

  // 2. Organizers
  try {
    const orgRes = await window.sb.from('organizer_directory').select('*');
    if (!orgRes.error && orgRes.data) {
      orgRes.data
        .filter(o => o && o.status === 'PENDING_VERIFICATION')
        .forEach(o => S2_QUEUE.push({
          id: o.organizer_id, table: 'organizers', idCol: 'organizer_id',
          entityType: 'ORGANIZER', name: o.org_name, detail: `Contact: ${o.contact_person || '—'} · ${o.city || ''}`,
          email: o.email || null, credentialId: o.registration_no || '—', documentUrl: o.document_url || null,
        }));
    }
  } catch (e) { console.warn('[SwimFest] organizer queue query:', e.message); }

  // 3. Academies
  try {
    const acRes = await window.sb.from('academies').select('*');
    if (!acRes.error && acRes.data) {
      acRes.data
        .filter(a => a && a.status === 'PENDING_VERIFICATION')
        .forEach(a => S2_QUEUE.push({
          id: a.academy_id, table: 'academies', idCol: 'academy_id',
          entityType: 'ACADEMY', name: a.academy_name, detail: `Location: ${a.city || '—'}`,
          email: a.created_by_email || null, credentialId: a.registration_no || '—', documentUrl: a.document_url || null,
        }));
    }
  } catch (e) { console.warn('[SwimFest] academies queue query:', e.message); }

  // 4. Coaches
  try {
    const coRes = await window.sb.from('coaches').select('*');
    if (!coRes.error && coRes.data) {
      coRes.data
        .filter(c => c && c.status === 'PENDING_VERIFICATION')
        .forEach(c => S2_QUEUE.push({
          id: c.coach_id, table: 'coaches', idCol: 'coach_id',
          entityType: 'COACH', name: c.full_name, detail: c.designation || 'Coach',
          email: c.created_by_email || null, credentialId: Array.isArray(c.certifications) ? c.certifications.join(', ') : '—', documentUrl: c.document_url || null,
        }));
    }
  } catch (e) { console.warn('[SwimFest] coaches queue query:', e.message); }

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
  const badge = $('reopenBadge');
  const body  = $('reopenBody');
  if (badge) badge.textContent = `${REOPEN_QUEUE.length} pending`;
  if (!body) return;
  if (!REOPEN_QUEUE.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray);">No reopen requests.</td></tr>`;
    return;
  }
  body.innerHTML = REOPEN_QUEUE.map((r, i) => `
    <tr id="reopen-row-${i}">
      <td>
        <div class="sa-meet-title">${escHtml(r.org_name || 'Organizer')}</div>
        <div class="sa-meet-sub">${escHtml(r.contact_person || '')}</div>
      </td>
      <td>${escHtml(r.tournament_title || '')}</td>
      <td style="max-width:260px;">${escHtml(r.reason || '')}</td>
      <td style="font-size:0.75rem;color:var(--gray);">${escHtml(new Date(r.created_at).toLocaleString('en-IN'))}</td>
      <td id="reopen-act-${i}">
        <button class="sa-btn-approve" onclick="approveReopen(${i})"><i class="fas fa-check"></i> Approve &amp; Reopen</button>
        <button class="sa-btn-reject" onclick="denyReopen(${i})"><i class="fas fa-times"></i> Deny</button>
      </td>
    </tr>`).join('');
}

window.approveReopen = async function(i) {
  const r = REOPEN_QUEUE[i];
  if (!r || !window.sb) return;
  const { error } = await window.sb.rpc('approve_reopen', { p_request_id: r.request_id });
  if (error) { console.error('[SwimFest] approve reopen:', error.message); showToast('Approve failed: ' + error.message, 'warn'); return; }
  await writeAudit('MEET_REOPENED', 'TOURNAMENT', r.tournament_id, `Reopen approved: ${r.tournament_title}`);
  const act = $(`reopen-act-${i}`);
  if (act) act.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Reopened</span>`;
  showToast(`Meet reopened: ${r.tournament_title}`, 'success');
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
};

// ── State Machine Visual ───────────────────────────────────────
function renderStateMachine() {
  $('saSmGrid').innerHTML = `
    <div class="sa-sm-queue">
      <div class="sa-sm-queue-title"><i class="fas fa-clipboard-list"></i> Approval Queue 1</div>
      <div style="font-weight:700;font-size:0.82rem;color:var(--dark);margin:4px 0;">Internal Meets</div>
      <div class="sa-sm-queue-sub">Submitted by Event Managers</div>
    </div>
    <div class="sa-sm-queue">
      <div class="sa-sm-queue-title"><i class="fas fa-building"></i> Approval Queue 2</div>
      <div style="font-weight:700;font-size:0.82rem;color:var(--dark);margin:4px 0;">Third-Party Meets</div>
      <div class="sa-sm-queue-sub">Submitted by Organizers</div>
    </div>
    <div class="sa-sm-queue">
      <div class="sa-sm-queue-title"><i class="fas fa-id-badge"></i> Approval Queue 3</div>
      <div style="font-weight:700;font-size:0.82rem;color:var(--dark);margin:4px 0;">Academies &amp; Coaches</div>
      <div class="sa-sm-queue-sub">Submitted by Event Managers</div>
    </div>`;

  $('saSmOutcomes').innerHTML = `
    <div class="sa-sm-outcome sa-sm-approve">
      <strong><i class="fas fa-check-circle"></i> Action: APPROVE</strong>
      <ul>
        <li>Internal/Hosted Meets transition to <strong>PUBLISHED</strong></li>
        <li>Academies/Coaches added to Master Directory globally</li>
        <li>Upfront fee verified before third-party approval</li>
      </ul>
    </div>
    <div class="sa-sm-outcome sa-sm-reject">
      <strong><i class="fas fa-times-circle"></i> Action: REJECT</strong>
      <ul>
        <li>Reverts to submitter's dashboard with rejection notes attached</li>
        <li>Status set to <strong>REJECTED_DRAFT</strong></li>
        <li>Email / WhatsApp notification dispatched to submitter</li>
      </ul>
    </div>`;
}

// ── Section 1A: Internal Meets ────────────────────────────────
function renderS1A() {
  $('s1aBadge').textContent = `${S1A_QUEUE.length} pending`;
  if (!S1A_QUEUE.length) {
    $('s1aBody').innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray);">No internal meets awaiting approval.</td></tr>`;
    return;
  }
  $('s1aBody').innerHTML = S1A_QUEUE.map((item, i) => {
    const emailTag = item.createdByEmail
      ? `<div style="font-size:0.72rem;color:var(--primary);margin-top:2px;"><i class="fas fa-envelope" style="font-size:0.65rem;"></i> ${escHtml(item.createdByEmail)}</div>`
      : '';
    return `<tr id="s1a-row-${i}">
      <td>
        <div style="font-weight:700;">${escHtml(item.createdBy)}</div>
        ${emailTag}
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
}

// ── Section 1B: Third-Party Meets ─────────────────────────────
function renderS1B() {
  $('s1bBadge').textContent = `${S1B_QUEUE.length} pending`;
  if (!S1B_QUEUE.length) {
    $('s1bBody').innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray);">No third-party meets awaiting approval.</td></tr>`;
    return;
  }
  $('s1bBody').innerHTML = S1B_QUEUE.map((item, i) => {
    const payChip = item.payType === 'A'
      ? `<span class="pay-chip pay-chip-a"><i class="fas fa-credit-card"></i> Option A (Platform GW)</span>`
      : `<span class="pay-chip pay-chip-b"><i class="fas fa-file-excel"></i> Option B (No Gateway)</span>`;
    const feeChip = item.feePaid === null
      ? `<span class="sa-fee-chip fee-na">N/A (Option A)</span>`
      : item.feePaid
        ? `<span class="sa-fee-chip fee-paid"><i class="fas fa-check-circle"></i> Paid (${item.feeAmt})</span>`
        : `<span class="sa-fee-chip fee-pending"><i class="fas fa-times-circle"></i> Unpaid</span>`;
    // Block approve if Option B and fee not paid
    const canApprove = item.feePaid !== false;
    const emailTag = item.createdByEmail
      ? `<div style="font-size:0.72rem;color:var(--primary);margin-top:2px;"><i class="fas fa-envelope" style="font-size:0.65rem;"></i> ${escHtml(item.createdByEmail)}</div>`
      : '';
    return `<tr id="s1b-row-${i}">
      <td>
        <div style="font-weight:700;">${escHtml(item.organizer)}</div>
        ${emailTag}
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
}

// ── Section 2: Academy & Coach Verification ───────────────────
function renderS2() {
  $('s2Badge').textContent = `${S2_QUEUE.length} pending`;
  if (!S2_QUEUE.length) {
    $('s2Body').innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray);">No academies or coaches awaiting verification.</td></tr>`;
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
        <div class="sa-meet-title">${escHtml(item.name)}</div>
        <div class="sa-meet-sub">${escHtml(item.detail)}</div>
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
    const { error } = await window.sb.from('tournaments')
      .update({ status: 'PUBLISHED' }).eq('tournament_id', item.id);
    ok = !error;
    if (ok) await writeAudit('EVENT_APPROVED', 'TOURNAMENT', item.id, `Approved & published: ${name}`);
    if (error) console.error('[SwimFest] approve meet:', error.message);
  } else {
    const { error } = await window.sb.from(item.table)
      .update({ status: 'APPROVED_ACTIVE' }).eq(item.idCol, item.id);
    ok = !error;
    if (ok) await writeAudit(item.entityType + '_VERIFIED', item.entityType, item.id, `Verified: ${name}`);
    if (error) console.error('[SwimFest] approve entity:', error.message);
  }

  if (!ok) { showToast('Approve failed — check permissions.', 'warn'); return; }
  actEl.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Approved</span>`;
  showToast(`Approved: ${name}`, 'success');
  recountBadge(section);
};

window.doReject = async function(section, idx) {
  const item = queueItem(section, idx);
  if (!item) return;
  const actEl = $(`${section}-act-${idx}`);
  const name = item.title || item.name;

  let ok = false;
  if (section === 's1a' || section === 's1b') {
    const { error } = await window.sb.from('tournaments')
      .update({ status: 'REJECTED_DRAFT' }).eq('tournament_id', item.id);
    ok = !error;
    if (ok) await writeAudit('EVENT_REJECTED', 'TOURNAMENT', item.id, `Rejected: ${name}`);
  } else {
    const { error } = await window.sb.from(item.table)
      .update({ status: 'REJECTED' }).eq(item.idCol, item.id);
    ok = !error;
    if (ok) await writeAudit(item.entityType + '_REJECTED', item.entityType, item.id, `Rejected: ${name}`);
  }

  if (!ok) { showToast('Reject failed — check permissions.', 'warn'); return; }
  actEl.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Rejected</span>`;
  showToast(`Rejected: ${name} — Returned to submitter.`, 'warn');
  recountBadge(section);
};

function recountBadge(section) {
  const pending = document.querySelectorAll(`[id^="${section}-act-"] button.sa-btn-approve`).length;
  const badgeId = section === 's1a' ? 's1aBadge' : section === 's1b' ? 's1bBadge' : 's2Badge';
  const el = $(badgeId);
  if (el) el.textContent = pending > 0 ? `${pending} pending` : '0 pending';
  if (el && pending === 0) el.style.background = 'var(--success)';
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
  banner.style.cssText = `position:fixed;top:104px;left:0;right:0;z-index:9998;
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

async function loadAllMeets() {
  if (!window.sb) return;
  try {
    const { data, error } = await window.sb
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[SwimFest] loadAllMeets:', error.message);
      return;
    }
    ALL_MEETS = data || [];
    renderAllMeets();
  } catch (e) {
    console.error('[SwimFest] loadAllMeets exception:', e);
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
  window.open(`event.html?tournament=${encTitle}`, '_blank');
  window.open(`admin.html?t=${encTitle}`, '_blank');
  window.open(`results.html`, '_blank');
  window.open(`heatsheets.html?tournament=${encTitle}`, '_blank');
  showToast(`Opening all sites/portals for: ${title}`, 'success');
};

window.approveMeetDirect = async function(tid, title) {
  if (!window.sb) return;
  const { error } = await window.sb.from('tournaments')
    .update({ status: 'PUBLISHED' }).eq('tournament_id', tid);
  if (error) {
    showToast('Approve failed: ' + error.message, 'warn');
    return;
  }
  await writeAudit('EVENT_APPROVED', 'TOURNAMENT', tid, `Approved & published from All Meets directory: ${title}`);
  showToast(`Meet Approved & Published: ${title}`, 'success');
  refreshLiveData();
};

function renderAllMeets() {
  const badge = $('allMeetsCountBadge');
  const body  = $('allMeetsBody');
  if (badge) badge.textContent = `${ALL_MEETS.length} Total Meets`;
  if (!body) return;

  let filtered = ALL_MEETS;
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
      REJECTED_DRAFT:   { cls: 'chip-draft',     label: 'Rejected' },
      DRAFT:            { cls: 'chip-draft',     label: 'Draft' },
    };
    const sc = statusMap[t.status] || { cls: 'chip-draft', label: t.status };
    const dateRange = fmtDateRange(t.start_date, t.end_date);
    const regClose = t.registration_deadline ? new Date(t.registration_deadline).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '—';
    const isPending = t.status === 'PENDING_APPROVAL';

    return `
      <tr>
        <td>
          <a href="event.html?tournament=${encTitle}" target="_blank" class="sa-meet-title" style="color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
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
            <a href="event.html?tournament=${encTitle}" target="_blank" class="em-action-btn em-btn-view" title="Open Public Event Page">
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
            <a href="racecontrol.html" target="_blank" class="em-action-btn em-btn-manage" title="Poolside Race Control">
              <i class="fas fa-stopwatch"></i> Race Control
            </a>
            <a href="saoverride.html?id=${tid}" target="_blank" class="em-action-btn em-btn-edit" title="Universal Override">
              <i class="fas fa-unlock-alt"></i> Override
            </a>
            <button onclick="openAllMeetSites('${escHtml(t.title.replace(/'/g, "\\'"))}', '${t.tournament_id}')" class="em-action-btn em-btn-all-sites" title="Open all associated pages for this meet in new tabs">
              <i class="fas fa-external-link-square-alt"></i> Open All Sites
            </button>
            ${isPending ? `
              <button class="sa-btn-approve" onclick="approveMeetDirect('${tid}', '${escHtml(t.title.replace(/'/g, "\\'"))}')" style="padding:4px 10px;font-size:0.7rem;"><i class="fas fa-check"></i> Approve</button>
            ` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Sub-nav tabs ──────────────────────────────────────────────
function switchTab(tabKey) {
  const validTabs = ['dashboard', 'meets', 'academies', 'financials'];
  if (!validTabs.includes(tabKey)) tabKey = 'dashboard';

  document.querySelectorAll('.sa-nav-tab[data-tab]').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabKey);
  });

  document.querySelectorAll('.sa-tab-panel').forEach(panel => {
    panel.style.display = (panel.getAttribute('data-tab-panel') === tabKey) ? 'block' : 'none';
  });

  if (history.replaceState) {
    history.replaceState(null, '', '#' + tabKey);
  }
}
window.switchTab = switchTab;

function initTabs() {
  document.querySelectorAll('.sa-nav-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      const tabKey = this.getAttribute('data-tab');
      switchTab(tabKey);
      const label = this.textContent.trim();
      showToast(`Section: ${label}`, 'info');
    });
  });

  const hash = (location.hash || '').replace('#', '');
  if (['dashboard', 'meets', 'academies', 'financials'].includes(hash)) {
    switchTab(hash);
  } else {
    switchTab('dashboard');
  }
}

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
function refreshLiveData() {
  // Skip while a modal is open so an in-progress action isn't disrupted
  if (document.querySelector('.modal-overlay.active')) return;
  loadMetrics();
  loadAllMeets();
  loadMeetQueues();
  loadVerificationQueue();
  loadReopenQueue();
}

document.addEventListener('DOMContentLoaded', () => {
  renderStateMachine();
  initTabs();
  // Live data + auto-refresh every 3s
  refreshLiveData();
  setInterval(refreshLiveData, 3000);
});
