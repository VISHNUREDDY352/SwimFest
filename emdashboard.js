/* ============================================================
   SwimFest — EM Dashboard JS   emdashboard.js
   ============================================================ */
'use strict';

// ── Tournament Pipeline Data ──────────────────────────────────
const TOURNAMENTS = [
  {
    id: 'TRN-TN-2026-010',
    title: "Golden Non-Medalist '26",
    sub:   "Matha Aquatic Arena, Chennai",
    dates: "Oct 15-16, 2026",
    mode:  "A",
    status: "PENDING_APPROVAL",
    swimmers: "9 entries",
  },
  {
    id: 'TRN-TN-2026-011',
    title: "District Schools Meet '26",
    sub:   "SDAT Aquatic Complex, Velachery, Chennai",
    dates: "Nov 05-07, 2026",
    mode:  "B",
    status: "PUBLISHED",
    swimmers: "184 swimmers · 462 entries",
  },
  {
    id: 'TRN-TN-2026-009',
    title: "Inter-Club Sprint Gala '26",
    sub:   "Anna Nagar Town Pool, Chennai",
    dates: "Jun 20-22, 2026",
    mode:  "A",
    status: "COMPLETED",
    swimmers: "132 swimmers · 389 entries",
  },
];

// ── Utilities ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function statusChip(s) {
  const map = {
    PENDING_APPROVAL: { cls:'chip-pending',   icon:'clock',       label:'Pending Approval' },
    PUBLISHED:        { cls:'chip-published',  icon:'check-circle',label:'Published (Live)' },
    COMPLETED:        { cls:'chip-completed',  icon:'lock',        label:'Completed / Archived' },
    DRAFT:            { cls:'chip-draft',      icon:'edit',        label:'Draft' },
  };
  const c = map[s] || map.DRAFT;
  return `<span class="em-status-chip ${c.cls}">
    <span class="status-dot"></span>
    <i class="fas fa-${c.icon}" style="font-size:0.65rem;"></i> ${c.label}
  </span>`;
}

function modeChip(m) {
  return m === 'A'
    ? `<span class="em-reg-mode reg-mode-a"><i class="fas fa-credit-card"></i> Option A — Online Gateway</span>`
    : `<span class="em-reg-mode reg-mode-b"><i class="fas fa-file-excel"></i> Option B — Bulk Offline</span>`;
}

function actionBtns(t) {
  if (t.status === 'PENDING_APPROVAL') return `
    <div class="em-action-group">
      <a href="addevent.html" class="em-action-btn em-btn-view"><i class="fas fa-eye"></i> View Summary</a>
      <a href="addevent.html" class="em-action-btn em-btn-edit"><i class="fas fa-pen"></i> Edit Draft</a>
    </div>`;
  if (t.status === 'PUBLISHED') return `
    <div class="em-action-group">
      <a href="admin.html" class="em-action-btn em-btn-manage"><i class="fas fa-cogs"></i> Manage</a>
      <a href="racecontrol.html" class="em-action-btn em-btn-race"><i class="fas fa-broadcast-tower"></i> Race Control</a>
    </div>`;
  if (t.status === 'COMPLETED') return `
    <div class="em-action-group">
      <a href="#" class="em-action-btn em-btn-archive"><i class="fas fa-archive"></i> View Archive</a>
    </div>`;
  return '';
}

// ── Render Pipeline Table ──────────────────────────────────────
function renderPipeline() {
  $('pipelineBody').innerHTML = TOURNAMENTS.map(t => `
    <tr>
      <td>
        <div class="em-meet-title">${escHtml(t.title)}</div>
        <div class="em-meet-sub"><i class="fas fa-map-marker-alt" style="color:var(--primary);font-size:0.65rem;"></i> ${escHtml(t.sub)}</div>
        <div class="em-meet-sub" style="margin-top:2px;font-style:italic;">${escHtml(t.swimmers)}</div>
      </td>
      <td>${escHtml(t.dates)}</td>
      <td>${modeChip(t.mode)}</td>
      <td>${statusChip(t.status)}</td>
      <td>${actionBtns(t)}</td>
    </tr>`).join('');
}

// ── Lifecycle Flow ────────────────────────────────────────────
function renderLifecycle() {
  const lc = $('lifecycleFlow');
  lc.innerHTML = `
    <div class="em-lifecycle-grid">
      <div class="em-lc-box start"><i class="fas fa-user-cog"></i> EM Dashboard</div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
      <div class="em-lc-box action">+ Add Event<br><small>(Option A or B)</small></div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>

      <div class="em-lc-box action">+ Add Academy /<br>Coach</div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
      <div class="em-lc-box action">Sent to Super Admin<br>Approval Queue</div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>

      <div class="em-lc-box state-published"><i class="fas fa-check-circle"></i> State: PUBLISHED<br><small>Live on Public Directory</small></div>
      <div class="em-lc-arrow"><i class="fas fa-arrows-alt-h"></i></div>
      <div class="em-lc-box state-rejected"><i class="fas fa-times-circle"></i> State: REJECTED<br><small>Returned with Feedback</small></div>
      <div></div>

      <div class="em-lc-box action">Live Race<br>Operations</div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
      <div class="em-lc-box action">Request Closure →<br>Super Admin Sign-Off</div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
    </div>
    <div class="em-lc-box state-completed" style="margin-top:8px;max-width:340px;">
      <i class="fas fa-lock"></i> State: COMPLETED_ARCHIVED — 100% Read-Only Data Lock
    </div>
    <div class="em-lc-list" style="margin-top:12px;">
      <strong>Live Race Operations include:</strong>
      <ul style="padding-left:18px;margin-top:6px;">
        <li>If Option B: Upload Bulk Roster Excel (.xlsx)</li>
        <li>Generate Multi-Pool Spearhead Heat Sheets</li>
        <li>Export CTS Excel / Re-upload Timing Excel</li>
        <li>Publish Results &amp; Standings</li>
      </ul>
    </div>`;
}

// ── Modal helpers ─────────────────────────────────────────────
window.openAddAcademyModal = () => openModal('addAcademyModal');
window.openAddCoachModal   = () => openModal('addCoachModal');

function openModal(id)  { const m=$(id); m.classList.add('active'); m.style.display='flex'; }
window.closeModal = function(id) { const m=$(id); m.classList.remove('active'); m.style.display='none'; }

window.submitAcademy = function() {
  closeModal('addAcademyModal');
  showToast('Academy submitted to Super Admin verification queue. ID: ACAD-TN-2026-' + Math.floor(100+Math.random()*900), 'success');
};

window.submitCoach = function() {
  closeModal('addCoachModal');
  showToast('Coach submitted to Super Admin verification queue. Status: PENDING_VERIFICATION', 'success');
};

// ── Toast ─────────────────────────────────────────────────────
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

(function(){
  const s=document.createElement('style');
  s.textContent=`
    .admin-toast{position:fixed;bottom:28px;right:28px;z-index:99999;
      padding:12px 20px;background:var(--dark);color:var(--white);
      border-radius:var(--radius-sm);font-size:0.85rem;font-weight:500;
      display:flex;align-items:center;gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);
      transform:translateY(20px);opacity:0;transition:all 0.3s ease;
      max-width:420px;font-family:'Inter',sans-serif;}
    .admin-toast.show{transform:translateY(0);opacity:1;}
    .admin-toast i{color:var(--accent);}
    .admin-toast.admin-toast-success i{color:var(--success);}
    .admin-toast.admin-toast-warn i{color:var(--warning);}`;
  document.head.appendChild(s);
})();

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPipeline();
  renderLifecycle();
});
