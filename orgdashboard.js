/* ============================================================
   SwimFest — Organizer Dashboard JS   orgdashboard.js
   ============================================================ */
'use strict';

const ORG_TOURNAMENTS = [
  {
    title   : "Coimbatore District Meet '26",
    sub     : "SDAT Pool, Kovai · 142 swimmers",
    dates   : "Nov 12-13",
    payType : "B",
    status  : "PENDING_APPROVAL",
    upfront : true,
  },
  {
    title   : "Kovai Winter Short Course",
    sub     : "SDAT Aquatic Complex, Kovai · 198 swimmers",
    dates   : "Dec 20-21",
    payType : "A",
    status  : "PUBLISHED",
    upfront : false,
  },
  {
    title   : "Kanyakumari Sprint Gala '25",
    sub     : "YMCA Nagercoil · 312 swimmers",
    dates   : "Dec 05-06",
    payType : "B",
    status  : "COMPLETED",
    upfront : true,
  },
];

const $ = id => document.getElementById(id);
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function payChip(t){
  return t === 'A'
    ? `<span class="em-reg-mode reg-mode-a"><i class="fas fa-credit-card"></i> Option A (Platform GW)</span>`
    : `<span class="em-reg-mode reg-mode-b"><i class="fas fa-file-excel"></i> Option B (No Gateway)</span>`;
}

function statusChip(s){
  const map = {
    PENDING_APPROVAL: { cls:'chip-pending',   dot:'warning',   label:'Pending Approval' },
    PUBLISHED:        { cls:'chip-published',  dot:'success',   label:'Published (Live)' },
    COMPLETED:        { cls:'chip-completed',  dot:'dark',      label:'Completed (Archived)' },
    DRAFT:            { cls:'chip-draft',      dot:'gray',      label:'Draft' },
  };
  const c = map[s] || map.DRAFT;
  return `<span class="em-status-chip ${c.cls}"><span class="status-dot"></span> ${c.label}</span>`;
}

function actionBtns(t){
  if (t.status === 'PENDING_APPROVAL') return `
    <div class="em-action-group">
      <a href="orgcreate.html"     class="em-action-btn em-btn-view"><i class="fas fa-eye"></i> View Summary</a>
      <a href="orgcreate.html"     class="em-action-btn em-btn-edit"><i class="fas fa-pen"></i> Edit Draft</a>
    </div>`;
  if (t.status === 'PUBLISHED') return `
    <div class="em-action-group">
      <a href="organizer.html"     class="em-action-btn em-btn-manage"><i class="fas fa-cogs"></i> Manage</a>
      <a href="orgracecontrol.html" class="em-action-btn em-btn-race"><i class="fas fa-broadcast-tower"></i> Race Control</a>
    </div>`;
  if (t.status === 'COMPLETED') return `
    <div class="em-action-group">
      <a href="#" class="em-action-btn em-btn-archive"><i class="fas fa-archive"></i> View Archive</a>
      <button class="em-action-btn em-btn-view" onclick="showToast('Printing result book…','info')"><i class="fas fa-print"></i> Print Results</button>
    </div>`;
  return '';
}

function renderPipeline(){
  $('orgPipelineBody').innerHTML = ORG_TOURNAMENTS.map(t => `
    <tr>
      <td>
        <div class="em-meet-title">${escHtml(t.title)}</div>
        <div class="em-meet-sub">${escHtml(t.sub)}</div>
        ${t.upfront ? `<div class="em-meet-sub" style="color:var(--warning);margin-top:3px;"><i class="fas fa-rupee-sign"></i> ₹5,000 upfront fee paid</div>` : ''}
      </td>
      <td>${escHtml(t.dates)}</td>
      <td>${payChip(t.payType)}</td>
      <td>${statusChip(t.status)}</td>
      <td>${actionBtns(t)}</td>
    </tr>`).join('');
}

function renderLifecycle(){
  $('orgLifecycle').innerHTML = `
    <div class="em-lifecycle-grid">
      <div class="em-lc-box start"><i class="fas fa-building"></i> Organizer Dashboard</div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
      <div class="em-lc-box action">Click "+ Create Event"<br><small>Draft Creation Canvas</small></div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>

      <div class="em-lc-box action">Option A: Platform GW<br><small>Online swimmer checkout</small></div>
      <div class="em-lc-arrow" style="font-size:0.8rem;color:var(--gray);">OR</div>
      <div class="em-lc-box action">Option B: No GW<br><small>Pay ₹5,000 Upfront Fee</small></div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>

      <div class="em-lc-box action" style="grid-column:1/3;">STATE: PENDING_SUPER_ADMIN_APPROVAL<br><small>Hidden from public directory</small></div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
      <div></div>

      <div class="em-lc-box state-published"><i class="fas fa-check-circle"></i> PUBLISHED<br><small>Live — accepts bookings / roster import</small></div>
      <div class="em-lc-arrow" style="color:var(--gray);">↔</div>
      <div class="em-lc-box state-rejected"><i class="fas fa-times-circle"></i> REJECTED_DRAFT<br><small>Returned with Super Admin notes</small></div>
      <div></div>

      <div class="em-lc-box action">LIVE_OPERATIONS<br><small>Import rosters, heat sheets, results</small></div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
      <div class="em-lc-box action">Request Meet Closure<br><small>Super Admin final sign-off</small></div>
      <div class="em-lc-arrow"><i class="fas fa-arrow-right"></i></div>
    </div>
    <div class="em-lc-box state-completed" style="margin-top:8px;max-width:400px;">
      <i class="fas fa-lock"></i> STATE: COMPLETED_ARCHIVED — 100% Immutable Data Lock<br>
      <small>Links to public archive · Organizer edit access permanently revoked</small>
    </div>`;
}

function showToast(msg, type='info'){
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

(function(){
  const s = document.createElement('style');
  s.textContent = `
    .admin-toast{position:fixed;bottom:28px;right:28px;z-index:99999;padding:12px 20px;
      background:var(--dark);color:var(--white);border-radius:var(--radius-sm);
      font-size:0.85rem;font-weight:500;display:flex;align-items:center;gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);transform:translateY(20px);opacity:0;
      transition:all 0.3s ease;max-width:420px;font-family:'Inter',sans-serif;}
    .admin-toast.show{transform:translateY(0);opacity:1;}
    .admin-toast i{color:var(--accent);}
    .admin-toast.admin-toast-success i{color:var(--success);}
    .admin-toast.admin-toast-warn i{color:var(--warning);}`;
  document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', ()=>{
  renderPipeline();
  renderLifecycle();
});
