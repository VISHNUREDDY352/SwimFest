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
    .select('tournament_id, title, host_organization, city, venue_name, start_date, end_date, gateway_option, status')
    .eq('status', 'PENDING_APPROVAL')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[SwimFest] queues:', error.message);
    $('s1aBadge').textContent = 'Error';
    $('s1bBadge').textContent = 'Error';
    showToast('Queue load failed: ' + error.message, 'warn');
    return;
  }
  console.info('[SwimFest] PENDING_APPROVAL tournaments found:', (data || []).length);

  const rows = data || [];
  // Split: Option A gateway → internal (1A); Option B → third-party (1B)
  S1A_QUEUE = rows.filter(t => t.gateway_option === 'OPTION_A_PLATFORM_GATEWAY').map(t => ({
    id: t.tournament_id, createdBy: t.host_organization || '—', title: t.title,
    dates: fmtDateRange(t.start_date, t.end_date), venue: `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`,
  }));
  S1B_QUEUE = rows.filter(t => t.gateway_option !== 'OPTION_A_PLATFORM_GATEWAY').map(t => ({
    id: t.tournament_id, organizer: t.host_organization || '—', title: t.title,
    payType: 'B', feePaid: true, feeAmt: '₹5,000',
  }));

  renderS1A();
  renderS1B();
}

// ── Supabase: pending academy / coach verifications ───────────
async function loadVerificationQueue() {
  if (!window.sb) return;
  const [ac, co, org] = await Promise.all([
    window.sb.from('academies').select('academy_id, academy_name, city, registration_no, document_url, status').eq('status', 'PENDING_VERIFICATION'),
    window.sb.from('coaches').select('coach_id, full_name, designation, certifications, document_url, status').eq('status', 'PENDING_VERIFICATION'),
    window.sb.from('organizer_directory').select('organizer_id, org_name, city, contact_person, registration_no, document_url, status').eq('status', 'PENDING_VERIFICATION'),
  ]);

  S2_QUEUE = [];
  (org.data || []).forEach(o => S2_QUEUE.push({
    id: o.organizer_id, table: 'organizers', idCol: 'organizer_id',
    entityType: 'ORGANIZER', name: o.org_name, detail: `Contact: ${o.contact_person || '—'} · ${o.city || ''}`,
    credentialId: o.registration_no || '—', documentUrl: o.document_url || null,
  }));
  (ac.data || []).forEach(a => S2_QUEUE.push({
    id: a.academy_id, table: 'academies', idCol: 'academy_id',
    entityType: 'ACADEMY', name: a.academy_name, detail: `Location: ${a.city || '—'}`,
    credentialId: a.registration_no || '—', documentUrl: a.document_url || null,
  }));
  (co.data || []).forEach(c => S2_QUEUE.push({
    id: c.coach_id, table: 'coaches', idCol: 'coach_id',
    entityType: 'COACH', name: c.full_name, detail: c.designation || 'Coach',
    credentialId: Array.isArray(c.certifications) ? c.certifications.join(', ') : '—', documentUrl: c.document_url || null,
  }));

  renderS2();
}

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
    return `<tr id="s1a-row-${i}">
      <td>${escHtml(item.createdBy)}</td>
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
    return `<tr id="s1b-row-${i}">
      <td>${escHtml(item.organizer)}</td>
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
    const entityBadge = item.entityType === 'ACADEMY'
      ? `<span class="entity-badge entity-academy"><i class="fas fa-building"></i> Academy</span>`
      : item.entityType === 'ORGANIZER'
        ? `<span class="entity-badge entity-academy"><i class="fas fa-user-tie"></i> Organizer</span>`
        : `<span class="entity-badge entity-coach"><i class="fas fa-chalkboard-teacher"></i> Coach</span>`;
    const submissionLabel = item.entityType === 'ACADEMY' ? 'Academy submission'
      : item.entityType === 'ORGANIZER' ? 'Organizer signup' : 'Coach submission';
    return `<tr id="s2-row-${i}">
      <td>${escHtml(submissionLabel)}</td>
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

// ── Sub-nav tabs ──────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.sa-nav-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.sa-nav-tab[data-tab]').forEach(t=>t.classList.remove('active'));
      this.classList.add('active');
      showToast(`Section: ${this.textContent.trim()} — loaded`, 'info');
    });
  });
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
  loadMeetQueues();
  loadVerificationQueue();
}

document.addEventListener('DOMContentLoaded', () => {
  renderStateMachine();
  initTabs();
  // Live data + auto-refresh every 3s
  refreshLiveData();
  setInterval(refreshLiveData, 3000);
});
