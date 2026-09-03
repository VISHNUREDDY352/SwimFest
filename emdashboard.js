/* ============================================================
   SwimFest — EM Dashboard JS   emdashboard.js
   ============================================================ */
'use strict';

// ── Tournament Pipeline Data (loaded from Supabase) ───────────
let TOURNAMENTS = [];

function fmtDates(s, e) {
  const f = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
  return s ? `${f(s)}${e ? ' – ' + f(e) : ''}` : '—';
}

async function loadPipeline() {
  if (!window.sb) { $('pipelineBody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray);">Database not connected.</td></tr>'; return; }

  // EM is the internal admin: this pipeline shows the platform's own
  // (internal) meets — Option A / platform-gateway — not third-party
  // organizer meets (Option B), which live on the Organizer dashboard.
  const { data, error } = await window.sb
    .from('tournaments')
    .select('tournament_id, title, venue_name, city, start_date, end_date, gateway_option, status')
    .eq('gateway_option', 'OPTION_A_PLATFORM_GATEWAY')
    .order('start_date', { ascending: false });

  if (error) { console.error('[SwimFest] pipeline:', error.message); return; }

  // Entry counts per tournament
  const counts = {};
  try {
    const { data: entries } = await window.sb.from('event_entries').select('tournament_id');
    (entries || []).forEach(e => { counts[e.tournament_id] = (counts[e.tournament_id] || 0) + 1; });
  } catch (_) {}

  TOURNAMENTS = (data || []).map(t => ({
    id: t.tournament_id,
    title: t.title,
    sub: `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`,
    dates: fmtDates(t.start_date, t.end_date),
    mode: t.gateway_option === 'OPTION_A_PLATFORM_GATEWAY' ? 'A' : 'B',
    status: t.status,
    swimmers: `${counts[t.tournament_id] || 0} entries`,
  }));

  // ── Real header metrics ──
  const rows = data || [];
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const emSession = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (emSession && emSession.name) setTxt('emIdentity', `${emSession.name} · Tamil Nadu Operations Team`);
  const totalEntries = rows.reduce((s, t) => s + (counts[t.tournament_id] || 0), 0);
  setTxt('emStatMeets', rows.length);
  setTxt('emStatEntries', totalEntries.toLocaleString('en-IN'));
  setTxt('emStatActive', rows.filter(t => t.status === 'LOCKED' || t.status === 'PUBLISHED').length);

  if (!TOURNAMENTS.length) {
    $('pipelineBody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray);">No internal meets yet. Click “Add Event” to create one.</td></tr>';
    return;
  }
  renderPipeline();
}

// ── Utilities ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function statusChip(s) {
  const map = {
    PENDING_APPROVAL: { cls:'chip-pending',   icon:'clock',       label:'Pending Approval' },
    PUBLISHED:        { cls:'chip-published',  icon:'check-circle',label:'Published (Live)' },
    LOCKED:           { cls:'chip-published',  icon:'lock',        label:'Locked (Heats Set)' },
    CLOSED:           { cls:'chip-pending',    icon:'clock',       label:'Registration Closed' },
    COMPLETED:        { cls:'chip-completed',  icon:'lock',        label:'Completed / Archived' },
    REJECTED_DRAFT:   { cls:'chip-draft',      icon:'times-circle',label:'Rejected' },
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
  const tid = encodeURIComponent(t.id || '');
  if (t.status === 'PENDING_APPROVAL') return `
    <div class="em-action-group">
      <a href="admin.html?t=${tid}" class="em-action-btn em-btn-view"><i class="fas fa-eye"></i> View Summary</a>
      <a href="addevent.html" class="em-action-btn em-btn-edit"><i class="fas fa-pen"></i> Edit Draft</a>
    </div>`;
  if (t.status === 'PUBLISHED' || t.status === 'LOCKED' || t.status === 'CLOSED') return `
    <div class="em-action-group">
      <a href="admin.html?t=${tid}" class="em-action-btn em-btn-manage"><i class="fas fa-cogs"></i> Manage</a>
      <a href="heatgen.html" class="em-action-btn em-btn-race"><i class="fas fa-bolt"></i> Heat Gen</a>
      <a href="results.html" class="em-action-btn em-btn-race"><i class="fas fa-broadcast-tower"></i> Results</a>
    </div>`;
  if (t.status === 'COMPLETED') return `
    <div class="em-action-group">
      <a href="heatsheets.html?tournament=${encodeURIComponent(t.title)}" class="em-action-btn em-btn-archive"><i class="fas fa-archive"></i> View Archive</a>
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

// Upload a verification document to Supabase Storage; return its public URL
async function uploadVerificationDoc(file, prefix) {
  if (!file || !window.sb) return null;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${prefix}/${Date.now()}_${safe}`;
  const { error } = await window.sb.storage.from('verification-docs').upload(path, file, { upsert: false });
  if (error) { console.error('[SwimFest] doc upload:', error.message); showToast('Document upload failed: ' + error.message, 'warn'); return null; }
  const { data } = window.sb.storage.from('verification-docs').getPublicUrl(path);
  return data ? data.publicUrl : null;
}

window.submitAcademy = async function() {
  const name = $('acName')?.value.trim();
  const city = $('acCity')?.value.trim();
  if (!name || !city) { showToast('Academy name and city are required.', 'warn'); return; }
  if (!window.sb) { showToast('Database not connected.', 'warn'); return; }

  const file = $('acDoc')?.files?.[0] || null;
  const docUrl = await uploadVerificationDoc(file, 'academies');

  const { error } = await window.sb.from('academies').insert({
    academy_name: name,
    city,
    state: $('acState')?.value.trim() || 'Tamil Nadu',
    registration_no: $('acRegNo')?.value.trim() || null,
    contact_person: $('acContact')?.value.trim() || null,
    phone_number: $('acPhone')?.value.trim() || null,
    document_url: docUrl,
    status: 'PENDING_VERIFICATION',
  });
  if (error) { console.error('[SwimFest] academy submit:', error.message); showToast('Submit failed: ' + error.message, 'warn'); return; }
  closeModal('addAcademyModal');
  showToast('Academy submitted to Super Admin verification queue.', 'success');
};

window.submitCoach = async function() {
  const name = $('coName')?.value.trim();
  const license = $('coLicense')?.value.trim();
  if (!name || !license) { showToast('Coach name and license number are required.', 'warn'); return; }
  if (!window.sb) { showToast('Database not connected.', 'warn'); return; }

  const file = $('coDoc')?.files?.[0] || null;
  const docUrl = await uploadVerificationDoc(file, 'coaches');

  const certBody = $('coCertBody')?.value || '';
  const { error } = await window.sb.from('coaches').insert({
    full_name: name,
    mobile_number: $('coPhone')?.value.trim() || null,
    certifications: [`${certBody} · ${license}`],
    document_url: docUrl,
    status: 'PENDING_VERIFICATION',
  });
  if (error) { console.error('[SwimFest] coach submit:', error.message); showToast('Submit failed: ' + error.message, 'warn'); return; }
  closeModal('addCoachModal');
  showToast('Coach submitted to Super Admin verification queue.', 'success');
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
  renderLifecycle();
  loadPipeline();
});
