/* ============================================================
   SwimFest — Super Admin Console JS   superadmin.js
   ============================================================ */
'use strict';

// ── Data: Internal Meets Queue (Section 1A) ───────────────────
const S1A_QUEUE = [
  {
    createdBy : 'R. Anand (EM-01)',
    title     : "Golden Non-Medalist '26",
    cats      : ['U10','U12','U14','U16'],
    dates     : 'Oct 15-16',
    venue     : 'SRM Univ Pool, Kattankulathur',
  },
  {
    createdBy : 'S. Kumar (EM-02)',
    title     : "State Sprint Aquatics '26",
    cats      : ['U12','U14','U16'],
    dates     : 'Nov 02-03',
    venue     : 'SDAT Complex, Velachery, Chennai',
  },
];

// ── Data: Third-Party Meets Queue (Section 1B) ────────────────
const S1B_QUEUE = [
  {
    organizer : 'Kovai Swim Club',
    title     : "Coimbatore District Meet '26",
    cats      : ['U10','U12','U14','U16'],
    payType   : 'B',
    feePaid   : true,
    feeAmt    : '₹5,000',
  },
  {
    organizer : 'Bluefins Aquatics',
    title     : "Kanyakumari Sprint Gala '26",
    cats      : ['U12','U14','U16'],
    payType   : 'A',
    feePaid   : null, // Option A — not applicable
    feeAmt    : null,
  },
];

// ── Data: Academy & Coach Verification Queue (Section 2) ──────
const S2_QUEUE = [
  {
    submittedBy  : 'S. Kumar (EM-02)',
    entityType   : 'ACADEMY',
    name         : 'Poseidon Aquatic Center',
    detail       : 'Location: Madurai',
    credentialId : 'TN-REG-2026-9982',
  },
  {
    submittedBy  : 'R. Anand (EM-01)',
    entityType   : 'COACH',
    name         : 'Coach V. Raman',
    detail       : 'Affiliation: Chennai SC',
    credentialId : 'ASCA Level 3 Cert · ID: ASCA-IND-883',
  },
];

// ── Permission Overview text ───────────────────────────────────
const PERM_ROWS = [
  { feature:'Approve / Publish Internal Meets',  em:'Draft & Submit Only',   org:'No Access',             sa:'Exclusive Permission' },
  { feature:'Approve / Publish Third-Party Meets',em:'No Access',            org:'Draft & Submit Only',   sa:'Exclusive Permission' },
  { feature:'Approve Academies & Coaches',        em:'Submit to Queue',      org:'No Access',             sa:'Exclusive Permission' },
  { feature:'Live Race Control & Result Entry',   em:'Assigned Meets Only',  org:'Owned Meets Only',      sa:'Universal Unrestricted Access' },
  { feature:'Edit Rules, Fees & Age Cutoffs',     em:'Locked (Read-Only)',   org:'Locked (Read-Only)',    sa:'Universal Override (Can Edit)' },
  { feature:'Reopen & Edit Completed Meets',      em:'Locked',               org:'Locked',                sa:'Universal Override (Can Reopen)' },
  { feature:'Platform Financials & Gateway',      em:'No Access',            org:'View Owned Summaries',  sa:'Full Oversight & Payout Control' },
  { feature:'System User Account Management',     em:'No Access',            org:'No Access',             sa:'Full Control (Create/Suspend)' },
];

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

// ── Permission Overview ────────────────────────────────────────
function renderPermOverview() {
  const el = $('permOverview');
  el.innerHTML = `
    <p style="margin-bottom:12px;">The <strong>Super Admin Module</strong> is the core governance hub. Super Admin possesses
    <strong>100% unrestricted CRUD permissions</strong> across all data tables, financial records, user accounts, and tournament states.</p>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
        <thead>
          <tr style="background:var(--dark);">
            <th style="padding:9px 14px;text-align:left;color:rgba(255,255,255,0.6);font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:220px;">Feature / Module</th>
            <th style="padding:9px 14px;color:rgba(255,255,255,0.6);font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Event Manager</th>
            <th style="padding:9px 14px;color:rgba(255,255,255,0.6);font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tournament Organizer</th>
            <th style="padding:9px 14px;color:rgba(255,255,255,0.6);font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Super Admin Permission</th>
          </tr>
        </thead>
        <tbody>
          ${PERM_ROWS.map(r=>`
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid var(--gray-light);font-weight:700;color:var(--dark);">${escHtml(r.feature)}</td>
              <td style="padding:10px 14px;border-bottom:1px solid var(--gray-light);color:var(--gray);">${escHtml(r.em)}</td>
              <td style="padding:10px 14px;border-bottom:1px solid var(--gray-light);color:var(--gray);">${escHtml(r.org)}</td>
              <td style="padding:10px 14px;border-bottom:1px solid var(--gray-light);font-weight:700;color:var(--primary);">${escHtml(r.sa)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
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
  $('s1aBody').innerHTML = S1A_QUEUE.map((item, i) => {
    const cats = item.cats.map(c=>`<span class="sa-cat-pill">${escHtml(c)}</span>`).join(' ');
    return `<tr id="s1a-row-${i}">
      <td>${escHtml(item.createdBy)}</td>
      <td>
        <div class="sa-meet-title">${escHtml(item.title)}</div>
        <div class="sa-meet-sub">${cats}</div>
      </td>
      <td>${escHtml(item.dates)}</td>
      <td>${escHtml(item.venue)}</td>
      <td id="s1a-act-${i}">
        <button class="sa-btn-approve" onclick="doApprove('s1a',${i},'${escHtml(item.title)}')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="doReject('s1a',${i},'${escHtml(item.title)}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Section 1B: Third-Party Meets ─────────────────────────────
function renderS1B() {
  $('s1bBadge').textContent = `${S1B_QUEUE.length} pending`;
  $('s1bBody').innerHTML = S1B_QUEUE.map((item, i) => {
    const cats = item.cats.map(c=>`<span class="sa-cat-pill">${escHtml(c)}</span>`).join(' ');
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
      <td>
        <div class="sa-meet-title">${escHtml(item.title)}</div>
        <div class="sa-meet-sub">${cats}</div>
      </td>
      <td>${payChip}</td>
      <td>${feeChip}</td>
      <td id="s1b-act-${i}">
        <button class="sa-btn-approve" ${!canApprove?'disabled title="Upfront fee not paid — cannot approve"':''} onclick="doApprove('s1b',${i},'${escHtml(item.title)}')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="doReject('s1b',${i},'${escHtml(item.title)}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Section 2: Academy & Coach Verification ───────────────────
function renderS2() {
  $('s2Badge').textContent = `${S2_QUEUE.length} pending`;
  $('s2Body').innerHTML = S2_QUEUE.map((item, i) => {
    const entityBadge = item.entityType === 'ACADEMY'
      ? `<span class="entity-badge entity-academy"><i class="fas fa-building"></i> Academy</span>`
      : `<span class="entity-badge entity-coach"><i class="fas fa-chalkboard-teacher"></i> Coach</span>`;
    return `<tr id="s2-row-${i}">
      <td>${escHtml(item.submittedBy)}</td>
      <td>${entityBadge}</td>
      <td>
        <div class="sa-meet-title">${escHtml(item.name)}</div>
        <div class="sa-meet-sub">${escHtml(item.detail)}</div>
      </td>
      <td style="font-family:monospace;font-size:0.78rem;">${escHtml(item.credentialId)}</td>
      <td id="s2-act-${i}">
        <button class="sa-btn-approve" onclick="doApprove('s2',${i},'${escHtml(item.name)}')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="doReject('s2',${i},'${escHtml(item.name)}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Approve / Reject actions ──────────────────────────────────
window.doApprove = function(section, idx, name) {
  const actEl = $(`${section}-act-${idx}`);
  actEl.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Approved</span>`;
  showToast(`Approved: ${name} — Published to public directory.`, 'success');
  recountBadge(section);
};

window.doReject = function(section, idx, name) {
  const actEl = $(`${section}-act-${idx}`);
  actEl.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Rejected</span>`;
  showToast(`Rejected: ${name} — Returned to submitter with notes.`, 'warn');
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
window.exportAuditLog = function() {
  const rows = [
    ['log_id','admin_id','action_type','target_entity','target_entity_id','notes','ip_address','created_at'],
    ['LOG-TN-2026-9921','SA-001','EVENT_APPROVED','TOURNAMENT','TRN-TN-2026-004','Golden Non-Medalist approved','103.21.244.0','2026-09-02T10:14:00Z'],
    ['LOG-TN-2026-9920','SA-001','ACADEMY_VERIFIED','ACADEMY','ACAD-TN-2026-104','Poseidon Aquatic Center verified','103.21.244.0','2026-09-02T09:52:00Z'],
    ['LOG-TN-2026-9919','SA-001','EVENT_REOPENED','TOURNAMENT','TRN-TN-2026-003','Age cutoff correction request','103.21.244.0','2026-09-01T17:44:00Z'],
    ['LOG-TN-2026-9918','SA-001','FEE_OVERRIDE','TOURNAMENT','TRN-TN-2026-002','Platform fee changed to ₹50','103.21.244.0','2026-09-01T16:20:00Z'],
    ['LOG-TN-2026-9917','SA-001','EVENT_REJECTED','TOURNAMENT','TRN-TN-2026-001','Insufficient venue details','103.21.244.0','2026-09-01T14:30:00Z'],
  ];
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SwimFest_SystemAuditLog_2026.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('System audit log exported as CSV.','success');
};
window.exportAuditLog = exportAuditLog;

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

window.publishNotice = function() {
  const title  = $('noticeTitle').value.trim();
  const msg    = $('noticeMsg').value.trim();
  const expiry = $('noticeExpiry').value;
  const active = $('noticeActive').value;
  if (!title || !msg) { showToast('Title and message are required.','warn'); return; }
  closeModal('noticeModal');
  const id = 'NTC-2026-0' + Math.floor(80 + Math.random()*20);
  showToast(`Emergency notice published. ID: ${id} · Expires in ${expiry}h`, 'success');
  // Show banner on page
  showEmergencyBanner(title, msg);
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
    .admin-toast.admin-toast-warn i{color:var(--warning);}`;
  document.head.appendChild(s);
})();

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPermOverview();
  renderStateMachine();
  renderS1A();
  renderS1B();
  renderS2();
  initTabs();
});
