/* ============================================================
   SwimFest — Organizer Dashboard JS   orgdashboard.js
   ============================================================ */
'use strict';

let ORG_TOURNAMENTS = [];
let MEET_FILTER = 'all';

const $ = id => document.getElementById(id);

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function fmtDates(s, e) {
  const f = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
  return s ? `${f(s)}${e ? ' – ' + f(e) : ''}` : '—';
}

// Load only THIS organizer's tournaments (created_by = current user)
async function loadOrgPipeline() {
  const body = $('orgPipelineBody');
  if (!window.sb) { body.innerHTML = '<div class="ac-empty">Database not connected.</div>'; return; }

  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  const userId = session ? session.userId : null;

  if (!userId) {
    body.innerHTML = '<div class="ac-empty">Please sign in as an organizer.</div>';
    return;
  }

  // An organizer is an outsider — this dashboard ALWAYS shows only the
  // meets they personally created. (Global view lives in Super Admin.)
  const { data, error } = await window.sb.from('tournaments')
    .select('tournament_id, title, venue_name, city, start_date, end_date, gateway_option, status, created_by')
    .eq('created_by', userId)
    .order('start_date', { ascending: false });
  if (error) {
    console.error('[SwimFest] org pipeline:', error.message);
    body.innerHTML = `<div class="ac-empty">Unable to load meets: ${escHtml(error.message)}</div>`;
    return;
  }

  const rows = data || [];
  const myIds = rows.map(t => t.tournament_id);

  // Entries for this organizer's tournaments only
  const counts = {};                 // entry rows per tournament
  const athleteSet = new Set();      // distinct swimmers hosted
  if (myIds.length) {
    try {
      const { data: entries } = await window.sb
        .from('event_entries').select('tournament_id, swimmer_id').in('tournament_id', myIds);
      (entries || []).forEach(e => {
        counts[e.tournament_id] = (counts[e.tournament_id] || 0) + 1;
        if (e.swimmer_id) athleteSet.add(e.swimmer_id);
      });
    } catch (_) {}
  }

  // Which of this organizer's meets already have a PENDING reopen request?
  const pendingReopen = new Set();
  if (myIds.length) {
    try {
      const { data: reqs } = await window.sb.from('reopen_requests')
        .select('tournament_id, status').in('tournament_id', myIds).eq('status', 'PENDING');
      (reqs || []).forEach(r => pendingReopen.add(r.tournament_id));
    } catch (_) {}
  }

  ORG_TOURNAMENTS = rows.map(t => ({
    id: t.tournament_id,
    title: t.title,
    venue: `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`,
    dates: fmtDates(t.start_date, t.end_date),
    optionB: t.gateway_option !== 'OPTION_A_PLATFORM_GATEWAY',
    status: t.status,
    entries: counts[t.tournament_id] || 0,
    reopenPending: pendingReopen.has(t.tournament_id),
  }));

  // ── Header metrics ──
  let orgName = (session && session.name) ? session.name : 'My Organization';
  try {
    const { data: orgRow } = await window.sb.from('organizers').select('org_name').eq('owner_id', userId).maybeSingle();
    if (orgRow && orgRow.org_name) orgName = orgRow.org_name;
  } catch (_) {}
  $('orgName').textContent = orgName;
  $('orgInitials').textContent = orgName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'OR';
  $('orgIdentity').textContent = `${orgName} · your hosted meets and their progress`;
  $('orgStatEvents').textContent = rows.length;
  $('orgMeetsCount').textContent = rows.length;
  $('orgStatAthletes').textContent = athleteSet.size.toLocaleString('en-IN');
  $('orgStatActive').textContent = rows.filter(t => ['PUBLISHED', 'CLOSED', 'LOCKED'].includes(t.status)).length;
  // Option B meets carry the ₹5,000 upfront software fee (payment status isn't stored yet)
  const optionBCount = ORG_TOURNAMENTS.filter(t => t.optionB).length;
  $('orgStatFees').textContent = '₹' + (optionBCount * 5000).toLocaleString('en-IN');

  renderPipeline();
}

const MEET_GROUP = {
  PENDING_APPROVAL: 'active', PUBLISHED: 'active', CLOSED: 'active', LOCKED: 'active', CLOSURE_REQUESTED: 'active',
  REJECTED_DRAFT: 'attention', DRAFT: 'attention',
  COMPLETED: 'done',
};

const STATUS_PILL = {
  PENDING_APPROVAL: { cls: 'ac-pill-wait',  label: 'Pending approval' },
  PUBLISHED:        { cls: 'ac-pill-live',  label: 'Published' },
  CLOSED:           { cls: 'ac-pill-wait',  label: 'Registration closed' },
  LOCKED:           { cls: 'ac-pill-live',  label: 'Heats locked' },
  CLOSURE_REQUESTED:{ cls: 'ac-pill-wait',  label: 'Closure requested' },
  COMPLETED:        { cls: 'ac-pill-done',  label: 'Completed' },
  REJECTED_DRAFT:   { cls: 'ac-pill-bad',   label: 'Rejected' },
  DRAFT:            { cls: 'ac-pill-draft', label: 'Draft' },
};

// Progress track: Approved → Entries → Heats → Live → Completed
function trackState(t) {
  switch (t.status) {
    case 'PENDING_APPROVAL': return { done: 0, now: 0 };
    case 'PUBLISHED':        return t.entries > 0 ? { done: 2, now: 2 } : { done: 1, now: 1 };
    case 'CLOSED':           return { done: 2, now: 2 };
    case 'LOCKED':           return { done: 3, now: 3 };
    case 'CLOSURE_REQUESTED':return { done: 4, now: 4 };
    case 'COMPLETED':        return { done: 5, now: -1 };
    case 'REJECTED_DRAFT':   return { done: 0, now: -1, bad: true };
    default:                 return { done: 0, now: -1 };
  }
}

function trackHtml(t) {
  const st = trackState(t);
  const steps = ['Approved', 'Entries', 'Heats', 'Live', 'Completed'];
  const cls = i => st.bad && i === 0 ? 'bad' : i < st.done ? 'done' : i === st.now ? 'now' : '';
  return `<div class="ac-track" aria-label="Progress">
    <div class="ac-track-bars">${steps.map((_, i) => `<span class="${cls(i)}"></span>`).join('')}</div>
    <div class="ac-track-labels">${steps.map((s, i) => `<span class="${cls(i)}">${s}</span>`).join('')}</div>
  </div>`;
}

// One clear next step per meet, plus a "more" menu for the rest
function actionsHtml(t) {
  const title = encodeURIComponent(t.title || '');
  const more = (links) => links.length ? `
    <details class="ac-more">
      <summary aria-label="More actions"><i class="fas fa-ellipsis"></i></summary>
      <div class="ac-more-menu">${links.map(l => `<a href="${l.href}"><i class="fas fa-${l.icon}"></i> ${l.label}</a>`).join('')}</div>
    </details>` : '';
  const publicPage = { href: `event.html?tournament=${title}`, icon: 'globe', label: 'Public event page' };
  const roster     = { href: 'playerlist.html', icon: 'list-check', label: 'Player list' };
  const results    = { href: 'results.html', icon: 'broadcast-tower', label: 'Live results' };
  const sheets     = { href: `heatsheets.html?tournament=${title}`, icon: 'file-lines', label: 'Heat sheets' };

  switch (t.status) {
    case 'PENDING_APPROVAL':
      return `<span class="ac-cta-note">Waiting for super admin approval</span>`;
    case 'CLOSURE_REQUESTED':
      return `<span class="ac-cta-note">Closure waiting for super admin sign-off</span>` + more([results, sheets]);
    case 'PUBLISHED':
    case 'CLOSED':
    case 'LOCKED':
      return `<a href="orgracecontrol.html?t=${encodeURIComponent(t.id)}" class="ac-cta ac-cta-primary"><i class="fas fa-flag-checkered"></i> Race control</a>`
        + more(t.status === 'LOCKED' ? [results, sheets, roster] : [roster, results, publicPage]);
    case 'COMPLETED': {
      const reopen = t.reopenPending
        ? `<span class="ac-cta-note"><i class="fas fa-clock"></i> Reopen requested</span>`
        : `<button type="button" class="ac-cta ac-cta-ghost" onclick="openReopenModal('${t.id}')"><i class="fas fa-unlock-alt"></i> Request reopen</button>`;
      return `<a href="heatsheets.html?tournament=${title}" class="ac-cta ac-cta-ghost"><i class="fas fa-box-archive"></i> View archive</a>${reopen}`;
    }
    case 'REJECTED_DRAFT':
      return `<span class="ac-cta-note">Returned by super admin</span>`;
    default:
      return `<span class="ac-cta-note">Not submitted yet</span>`;
  }
}

function renderPipeline() {
  const body = $('orgPipelineBody');
  if (!ORG_TOURNAMENTS.length) {
    body.innerHTML = '<div class="ac-empty">No meets yet. Use <strong>Create event</strong> to host your first meet.</div>';
    return;
  }
  const list = MEET_FILTER === 'all' ? ORG_TOURNAMENTS : ORG_TOURNAMENTS.filter(t => (MEET_GROUP[t.status] || 'attention') === MEET_FILTER);
  if (!list.length) {
    body.innerHTML = '<div class="ac-empty">No meets in this view.</div>';
    return;
  }
  body.innerHTML = list.map(t => {
    const pill = STATUS_PILL[t.status] || STATUS_PILL.DRAFT;
    const payment = t.optionB ? 'Option B · offline payments, ₹5,000 software fee' : 'Option A · online gateway';
    return `
    <article class="ac-meet">
      <div class="ac-meet-info">
        <div class="ac-meet-top">
          <h3 class="ac-meet-title">${escHtml(t.title)}</h3>
          <span class="ac-pill ${pill.cls}">${pill.label}</span>
        </div>
        <span class="ac-meet-meta">${escHtml(t.dates)}${t.venue ? ' · ' + escHtml(t.venue) : ''}</span>
        <span class="ac-meet-meta-2">${t.entries} ${t.entries === 1 ? 'entry' : 'entries'} · ${payment}</span>
      </div>
      ${trackHtml(t)}
      <div class="ac-meet-actions">${actionsHtml(t)}</div>
    </article>`;
  }).join('');
}

// ── Request to reopen a completed meet (needs Super Admin approval) ──
let REOPEN_ID = null;

window.openReopenModal = function(tournamentId) {
  const meet = ORG_TOURNAMENTS.find(m => m.id === tournamentId);
  REOPEN_ID = tournamentId;
  $('reopenMeetTitle').textContent = meet ? meet.title : 'this meet';
  $('reopenReason').value = '';
  $('reopenReasonErr').textContent = '';
  const m = $('reopenModal'); m.classList.add('active'); m.style.display = 'flex';
  $('reopenReason').focus();
};

window.closeReopenModal = function() {
  const m = $('reopenModal'); m.classList.remove('active'); m.style.display = 'none';
};

window.submitReopen = async function() {
  const reason = $('reopenReason').value.trim();
  if (!reason) { $('reopenReasonErr').textContent = 'Add a reason so the super admin can review the request.'; return; }
  if (!window.sb) { showToast('Database not connected.', 'warn'); return; }

  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  const { error } = await window.sb.from('reopen_requests').insert({
    tournament_id: REOPEN_ID,
    requested_by: session ? session.userId : null,
    reason,
    status: 'PENDING',
  });
  if (error) { console.error('[SwimFest] reopen request:', error.message); showToast('Request failed: ' + error.message, 'warn'); return; }
  closeReopenModal();
  showToast('Reopen request sent to Super Admin for approval.', 'success');
  loadOrgPipeline();  // refresh so the meet shows "Reopen requested"
};

// ── Sidebar navigation ────────────────────────────────────────
function setNavOpen(open) {
  $('acShell').classList.toggle('nav-open', open);
  $('acMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

function initNav() {
  document.querySelectorAll('.ac-side-link[data-nav]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.getAttribute('data-nav');
      document.querySelectorAll('.ac-side-link[data-nav]').forEach(l => l.classList.toggle('active', l === link));
      if (target === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      else $(target).scrollIntoView({ behavior: 'smooth', block: 'start' });
      setNavOpen(false);
    });
  });

  $('acMenuBtn').addEventListener('click', () => setNavOpen(!$('acShell').classList.contains('nav-open')));
  $('acScrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { setNavOpen(false); closeReopenModal(); }
  });

  document.querySelectorAll('#acMeetFilters [data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      MEET_FILTER = btn.getAttribute('data-filter');
      document.querySelectorAll('#acMeetFilters [data-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderPipeline();
    });
  });

  // Close an open "more" menu when clicking elsewhere
  document.addEventListener('click', e => {
    document.querySelectorAll('.ac-more[open]').forEach(d => { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });
}

// ── Toast ─────────────────────────────────────────────────────
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
  initNav();
  const sess = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (sess && sess.userId) $('orgIdBadge').textContent = 'Organizer · ID ' + String(sess.userId).slice(0, 8).toUpperCase();
  loadOrgPipeline();
});
