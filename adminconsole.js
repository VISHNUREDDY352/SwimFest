/* ============================================================
   SwimFest — Admin Console Logic   adminconsole.js
   ============================================================ */
'use strict';

let PENDING_SWIMMERS  = [];
let PENDING_COACHES   = [];
let PENDING_ACADEMIES = [];
let PENDING_EVENTS    = [];

const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg, type = 'info') {
  const existing = document.querySelector('.admin-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'warn' ? 'exclamation-triangle' : 'info-circle';
  toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}
window.showToast = showToast;

function switchAdminTab(tabId, btnEl) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));

  const target = $(tabId);
  if (target) target.classList.add('active');
  if (btnEl) btnEl.classList.add('active');
}
window.switchAdminTab = switchAdminTab;

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
  } catch (e) {
    console.warn('[AdminConsole] audit error:', e.message);
  }
}

// ── Load Pending Data ──────────────────────────────────────────
async function loadAllQueues() {
  if (!window.sb) {
    console.warn('[AdminConsole] Supabase client not ready');
    return;
  }

  const queryTerm = ($('adminConsoleSearch') ? $('adminConsoleSearch').value : '').toLowerCase().trim();

  // 1. Load Pending Swimmers
  try {
    const swRes = await window.sb.from('swimmers').select('*');
    if (!swRes.error && swRes.data) {
      PENDING_SWIMMERS = swRes.data.filter(s => s && s.status === 'PENDING_VERIFICATION');
    } else {
      PENDING_SWIMMERS = [];
    }
  } catch (e) {
    console.warn('[AdminConsole] swimmers load error:', e.message);
    PENDING_SWIMMERS = [];
  }

  // 2. Load Pending Coaches
  try {
    const coRes = await window.sb.from('coaches').select('*');
    if (!coRes.error && coRes.data) {
      PENDING_COACHES = coRes.data.filter(c => c && c.status === 'PENDING_VERIFICATION');
    } else {
      PENDING_COACHES = [];
    }
  } catch (e) {
    console.warn('[AdminConsole] coaches load error:', e.message);
    PENDING_COACHES = [];
  }

  // 3. Load Pending Academies
  try {
    const acRes = await window.sb.from('academies').select('*');
    if (!acRes.error && acRes.data) {
      PENDING_ACADEMIES = acRes.data.filter(a => a && a.status === 'PENDING_VERIFICATION');
    } else {
      PENDING_ACADEMIES = [];
    }
  } catch (e) {
    console.warn('[AdminConsole] academies load error:', e.message);
    PENDING_ACADEMIES = [];
  }

  // 4. Load Pending Events / Tournaments
  try {
    const evRes = await window.sb.from('tournaments').select('*').eq('status', 'PENDING_APPROVAL');
    if (!evRes.error && evRes.data) {
      PENDING_EVENTS = evRes.data;
    } else {
      PENDING_EVENTS = [];
    }
  } catch (e) {
    console.warn('[AdminConsole] events load error:', e.message);
    PENDING_EVENTS = [];
  }

  updateBadgesAndMetrics();
  renderSwimmers(queryTerm);
  renderCoaches(queryTerm);
  renderAcademies(queryTerm);
  renderEvents(queryTerm);
}
window.loadAllQueues = loadAllQueues;

function updateBadgesAndMetrics() {
  if ($('cntSwimmers'))   $('cntSwimmers').textContent   = PENDING_SWIMMERS.length;
  if ($('cntCoaches'))    $('cntCoaches').textContent    = PENDING_COACHES.length;
  if ($('cntAcademies'))  $('cntAcademies').textContent  = PENDING_ACADEMIES.length;
  if ($('cntEvents'))     $('cntEvents').textContent     = PENDING_EVENTS.length;

  if ($('badgeSwimmers'))  $('badgeSwimmers').textContent  = PENDING_SWIMMERS.length;
  if ($('badgeCoaches'))   $('badgeCoaches').textContent   = PENDING_COACHES.length;
  if ($('badgeAcademies')) $('badgeAcademies').textContent = PENDING_ACADEMIES.length;
  if ($('badgeEvents'))    $('badgeEvents').textContent    = PENDING_EVENTS.length;
}

// ── Renders ───────────────────────────────────────────────────
function renderSwimmers(q = '') {
  const tbody = $('swimmersTableBody');
  if (!tbody) return;

  const filtered = PENDING_SWIMMERS.filter(s => {
    if (!q) return true;
    const txt = `${s.full_name || ''} ${s.parent_name || ''} ${s.parent_email || ''} ${s.parent_phone || ''} ${s.school_name || ''} ${s.sfi_serial_no || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray);"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px;"></i> No pending swimmer verifications found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, i) => `
    <tr id="sw-row-${s.swimmer_id}">
      <td>
        <div style="font-weight:700;color:var(--dark);">${escHtml(s.full_name)}</div>
        <div style="font-size:0.72rem;color:var(--gray);">Ref: ${escHtml(s.sfi_serial_no || 'SWM-' + s.swimmer_id)}</div>
      </td>
      <td>
        <div>${escHtml(s.gender || '—')}</div>
        <div style="font-size:0.75rem;color:var(--gray);">${escHtml(s.date_of_birth ? 'DOB: ' + s.date_of_birth : '—')}</div>
      </td>
      <td><span class="grid-cat-pill">${escHtml(s.category || 'Open')}</span></td>
      <td>
        <div style="font-weight:600;">${escHtml(s.parent_name || '—')} (${escHtml(s.parent_phone || '—')})</div>
        <div style="font-size:0.72rem;color:var(--primary);">${escHtml(s.parent_email || '—')}</div>
        <div style="font-size:0.72rem;color:var(--gray);">${escHtml(s.school_name ? 'School: ' + s.school_name : '')}</div>
      </td>
      <td style="font-family:monospace;font-size:0.8rem;">${escHtml(s.sfi_serial_no || s.id_ref || '—')}</td>
      <td id="sw-act-${s.swimmer_id}">
        <button class="sa-btn-approve" onclick="approveSwimmer('${s.swimmer_id}', '${escHtml(s.full_name)}')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="rejectSwimmer('${s.swimmer_id}', '${escHtml(s.full_name)}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>
  `).join('');
}

function renderCoaches(q = '') {
  const tbody = $('coachesTableBody');
  if (!tbody) return;

  const filtered = PENDING_COACHES.filter(c => {
    if (!q) return true;
    const txt = `${c.full_name || ''} ${c.designation || ''} ${c.created_by_email || ''} ${c.academy_name || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray);"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px;"></i> No pending coach verifications found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr id="co-row-${c.coach_id}">
      <td>
        <div style="font-weight:700;color:var(--dark);">${escHtml(c.full_name)}</div>
      </td>
      <td>
        <div>${escHtml(c.designation || 'Coach')}</div>
        <div style="font-size:0.72rem;color:var(--gray);">${escHtml(c.academy_name || 'Independent')}</div>
      </td>
      <td style="font-size:0.8rem;color:var(--primary);">${escHtml(c.created_by_email || '—')}</td>
      <td style="font-size:0.8rem;">${escHtml(Array.isArray(c.certifications) ? c.certifications.join(', ') : c.certifications || '—')}</td>
      <td>
        ${c.document_url ? `<a href="${escHtml(c.document_url)}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--primary);"><i class="fas fa-file-alt"></i> View Doc</a>` : `<span style="font-size:0.75rem;color:var(--gray);">No document</span>`}
      </td>
      <td id="co-act-${c.coach_id}">
        <button class="sa-btn-approve" onclick="approveCoach('${c.coach_id}', '${escHtml(c.full_name)}')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="rejectCoach('${c.coach_id}', '${escHtml(c.full_name)}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>
  `).join('');
}

function renderAcademies(q = '') {
  const tbody = $('academiesTableBody');
  if (!tbody) return;

  const filtered = PENDING_ACADEMIES.filter(a => {
    if (!q) return true;
    const txt = `${a.academy_name || ''} ${a.city || ''} ${a.created_by_email || ''} ${a.registration_no || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray);"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px;"></i> No pending academy verifications found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => `
    <tr id="ac-row-${a.academy_id}">
      <td>
        <div style="font-weight:700;color:var(--dark);">${escHtml(a.academy_name)}</div>
      </td>
      <td>${escHtml(a.city || '—')}</td>
      <td style="font-size:0.8rem;color:var(--primary);">${escHtml(a.created_by_email || '—')}</td>
      <td style="font-family:monospace;font-size:0.8rem;">${escHtml(a.registration_no || '—')}</td>
      <td>
        ${a.document_url ? `<a href="${escHtml(a.document_url)}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--primary);"><i class="fas fa-file-alt"></i> View Doc</a>` : `<span style="font-size:0.75rem;color:var(--gray);">No document</span>`}
      </td>
      <td id="ac-act-${a.academy_id}">
        <button class="sa-btn-approve" onclick="approveAcademy('${a.academy_id}', '${escHtml(a.academy_name)}')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="sa-btn-reject" onclick="rejectAcademy('${a.academy_id}', '${escHtml(a.academy_name)}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>
  `).join('');
}

function renderEvents(q = '') {
  const tbody = $('eventsTableBody');
  if (!tbody) return;

  const filtered = PENDING_EVENTS.filter(e => {
    if (!q) return true;
    const txt = `${e.title || ''} ${e.host_organization || ''} ${e.city || ''} ${e.venue_name || ''}`.toLowerCase();
    return txt.includes(q);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--gray);"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px;"></i> No pending event approvals found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr id="ev-row-${e.tournament_id}">
      <td>
        <div style="font-weight:700;color:var(--dark);">${escHtml(e.host_organization || 'Organizer')}</div>
        <div style="font-size:0.72rem;color:var(--gray);">${escHtml(e.created_by_email || '')}</div>
      </td>
      <td><div style="font-weight:700;color:var(--primary);">${escHtml(e.title)}</div></td>
      <td>
        <div>${escHtml(e.start_date || 'TBD')} ${e.end_date ? '– ' + e.end_date : ''}</div>
        <div style="font-size:0.72rem;color:var(--gray);">${escHtml(e.venue_name || '')} ${e.city ? ', ' + e.city : ''}</div>
      </td>
      <td>
        <span class="pay-chip pay-chip-a">${escHtml(e.gateway_option === 'OPTION_A_PLATFORM_GATEWAY' ? 'Option A (Platform GW)' : 'Option B (No GW)')}</span>
      </td>
      <td id="ev-act-${e.tournament_id}">
        <button class="sa-btn-approve" onclick="approveEvent('${e.tournament_id}', '${escHtml(e.title)}')">
          <i class="fas fa-check"></i> Approve &amp; Publish
        </button>
        <button class="sa-btn-reject" onclick="rejectEvent('${e.tournament_id}', '${escHtml(e.title)}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </td>
    </tr>
  `).join('');
}

function checkAdminAuth() {
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (!session || (session.role !== 'super_admin' && session.role !== 'event_manager')) {
    showToast('Admin authorization required to perform verifications.', 'warn');
    return false;
  }
  return true;
}

// ── Action Handlers ───────────────────────────────────────────
window.approveSwimmer = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`sw-act-${id}`);
  const { error } = await window.sb.from('swimmers').update({ status: 'APPROVED_ACTIVE' }).eq('swimmer_id', id);
  if (error) {
    showToast(`Failed to approve swimmer: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('SWIMMER_VERIFIED', 'SWIMMER', id, `Approved swimmer: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Approved</span>`;
  showToast(`Swimmer "${name}" approved successfully!`, 'success');
  PENDING_SWIMMERS = PENDING_SWIMMERS.filter(s => String(s.swimmer_id) !== String(id));
  updateBadgesAndMetrics();
};

window.rejectSwimmer = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`sw-act-${id}`);
  const { error } = await window.sb.from('swimmers').update({ status: 'REJECTED' }).eq('swimmer_id', id);
  if (error) {
    showToast(`Failed to reject swimmer: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('SWIMMER_REJECTED', 'SWIMMER', id, `Rejected swimmer: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Rejected</span>`;
  showToast(`Swimmer "${name}" rejected.`, 'info');
  PENDING_SWIMMERS = PENDING_SWIMMERS.filter(s => String(s.swimmer_id) !== String(id));
  updateBadgesAndMetrics();
};

window.approveCoach = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`co-act-${id}`);
  const { error } = await window.sb.from('coaches').update({ status: 'APPROVED_ACTIVE' }).eq('coach_id', id);
  if (error) {
    showToast(`Failed to approve coach: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('COACH_VERIFIED', 'COACH', id, `Approved coach: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Approved</span>`;
  showToast(`Coach "${name}" approved!`, 'success');
  PENDING_COACHES = PENDING_COACHES.filter(c => String(c.coach_id) !== String(id));
  updateBadgesAndMetrics();
};

window.rejectCoach = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`co-act-${id}`);
  const { error } = await window.sb.from('coaches').update({ status: 'REJECTED' }).eq('coach_id', id);
  if (error) {
    showToast(`Failed to reject coach: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('COACH_REJECTED', 'COACH', id, `Rejected coach: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Rejected</span>`;
  showToast(`Coach "${name}" rejected.`, 'info');
  PENDING_COACHES = PENDING_COACHES.filter(c => String(c.coach_id) !== String(id));
  updateBadgesAndMetrics();
};

window.approveAcademy = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`ac-act-${id}`);
  const { error } = await window.sb.from('academies').update({ status: 'APPROVED_ACTIVE' }).eq('academy_id', id);
  if (error) {
    showToast(`Failed to approve academy: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('ACADEMY_VERIFIED', 'ACADEMY', id, `Approved academy: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Approved</span>`;
  showToast(`Academy "${name}" approved!`, 'success');
  PENDING_ACADEMIES = PENDING_ACADEMIES.filter(a => String(a.academy_id) !== String(id));
  updateBadgesAndMetrics();
};

window.rejectAcademy = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`ac-act-${id}`);
  const { error } = await window.sb.from('academies').update({ status: 'REJECTED' }).eq('academy_id', id);
  if (error) {
    showToast(`Failed to reject academy: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('ACADEMY_REJECTED', 'ACADEMY', id, `Rejected academy: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Rejected</span>`;
  showToast(`Academy "${name}" rejected.`, 'info');
  PENDING_ACADEMIES = PENDING_ACADEMIES.filter(a => String(a.academy_id) !== String(id));
  updateBadgesAndMetrics();
};

window.approveEvent = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`ev-act-${id}`);
  const { error } = await window.sb.from('tournaments').update({ status: 'PUBLISHED' }).eq('tournament_id', id);
  if (error) {
    showToast(`Failed to approve event: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('EVENT_APPROVED', 'TOURNAMENT', id, `Approved event: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Published</span>`;
  showToast(`Event "${name}" published!`, 'success');
  PENDING_EVENTS = PENDING_EVENTS.filter(e => String(e.tournament_id) !== String(id));
  updateBadgesAndMetrics();
};

window.rejectEvent = async function(id, name) {
  if (!checkAdminAuth()) return;
  const actCell = $(`ev-act-${id}`);
  const { error } = await window.sb.from('tournaments').update({ status: 'REJECTED_DRAFT' }).eq('tournament_id', id);
  if (error) {
    showToast(`Failed to reject event: ${error.message}`, 'warn');
    return;
  }
  await writeAudit('EVENT_REJECTED', 'TOURNAMENT', id, `Rejected event: ${name}`);
  if (actCell) actCell.innerHTML = `<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Rejected</span>`;
  showToast(`Event "${name}" rejected.`, 'info');
  PENDING_EVENTS = PENDING_EVENTS.filter(e => String(e.tournament_id) !== String(id));
  updateBadgesAndMetrics();
};

// ── Search Binding ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (session && session.role === 'super_admin' && $('superAdminLink')) {
    $('superAdminLink').style.display = 'inline-flex';
  }

  const searchInput = $('adminConsoleSearch');
  const clearBtn   = $('adminConsoleSearchClear');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const val = searchInput.value.trim().toLowerCase();
      if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
      renderSwimmers(val);
      renderCoaches(val);
      renderAcademies(val);
      renderEvents(val);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearBtn.style.display = 'none';
      renderSwimmers();
      renderCoaches();
      renderAcademies();
      renderEvents();
    });
  }

  // Initial load
  loadAllQueues();
});
