/* ============================================================
   SwimFest — Homepage tournament loader (Stage 4a)   home.js
   Fetches tournaments from Supabase and renders cards into the
   Upcoming / Ongoing / Past sections. Falls back to the static
   HTML already present if the DB is unreachable.
   ============================================================ */
'use strict';

(function () {
  const POSTER_THEMES = ['upcoming-poster-1','upcoming-poster-2','past-poster-1','past-poster-2','past-poster-3'];
  const PAST_THEMES    = ['past-poster-1','past-poster-2','past-poster-3'];

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }

  function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

  // Build one tournament card
  function card(t, idx, isPast) {
    const theme = isPast ? PAST_THEMES[idx % PAST_THEMES.length] : POSTER_THEMES[idx % 2];
    const shortName = t.title.length > 24 ? t.title.slice(0, 22) + '…' : t.title;
    const statusMap = {
      PUBLISHED: { cls:'status-open', label:'Entries Open', filter:'entries-open' },
      CLOSED:    { cls:'status-closing-soon', label:'Closing Soon', filter:'closing-soon' },
      LOCKED:    { cls:'status-live', label:'Live Now', filter:'live-now' },
      COMPLETED: { cls:'status-completed', label:'Completed', filter:'completed' },
    };
    const st = statusMap[t.status] || statusMap.PUBLISHED;
    const regParam = encodeURIComponent(t.title);

    // Data attributes used by the home-page search/category/status filter
    const dataCats = 'U-10,U-12,U-14,U-16';
    const dataStatus = st.filter;

    const catBadges = ['U10','U12','U14','U16'].map(c => `<span class="cat-badge">${c}</span>`).join('');

    if (isPast) {
      return `
      <div class="event-card past-card" data-name="${esc(t.title)}" data-venue="${esc(t.venue_name)}" data-categories="${dataCats}" data-status="${dataStatus}">
        <div class="completed-badge">Completed</div>
        <div class="card-image">
          <div class="card-poster ${theme}"><i class="fas fa-medal"></i><span>${esc(shortName)}</span></div>
          <div class="card-categories"><span class="cat-badge">All Groups</span></div>
        </div>
        <div class="card-body">
          <h3 class="card-event-title">${esc(t.title)}</h3>
          <div class="card-info-list">
            <p><i class="fas fa-map-marker-alt"></i> <strong>Venue:</strong> ${esc(t.venue_name)}, ${esc(t.city)}</p>
            <p><i class="fas fa-calendar-alt"></i> <strong>Dates:</strong> ${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</p>
            <p><i class="fas fa-swimming-pool"></i> <strong>Pool:</strong> ${esc(t.pool_length)} · ${t.lane_count} Lanes</p>
          </div>
          <div class="card-actions">
            <a href="heatsheets.html?tournament=${regParam}" class="btn-card btn-details">View Final Results</a>
            <a href="heatsheets.html?tournament=${regParam}" class="btn-card btn-download"><i class="fas fa-file-pdf"></i> Result Book</a>
          </div>
        </div>
      </div>`;
    }

    return `
      <div class="event-card" data-name="${esc(t.title)}" data-venue="${esc(t.venue_name)}" data-categories="${dataCats}" data-status="${dataStatus}">
        <div class="card-image">
          <div class="card-poster ${theme}"><i class="fas fa-trophy"></i><span>${esc(shortName)}</span></div>
          <div class="card-categories">${catBadges}</div>
          <span class="status-badge ${st.cls}">${st.label}</span>
        </div>
        <div class="card-body">
          <h3 class="card-event-title">${esc(t.title)}</h3>
          <div class="card-info-list">
            <p><i class="fas fa-users"></i> <strong>Categories:</strong> U-10 to U-16 (Boys &amp; Girls)</p>
            <p><i class="fas fa-map-marker-alt"></i> <strong>Venue:</strong> ${esc(t.venue_name)}, ${esc(t.city)}</p>
            <p><i class="fas fa-calendar-alt"></i> <strong>Dates:</strong> ${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</p>
            <p><i class="fas fa-rupee-sign"></i> <strong>Fee:</strong> ${money(t.reg_fee_amount)} package · Max ${t.max_individual_events || 3} events</p>
            <p><i class="fas fa-gavel"></i> <strong>Rules:</strong> ${t.allow_swim_up ? 'Swim-Up Enabled' : 'Single Category Only'}</p>
          </div>
          <div class="card-actions">
            <a href="event.html?tournament=${regParam}" class="btn-card btn-register" style="flex:1;">Register Now <i class="fas fa-arrow-right"></i></a>
          </div>
        </div>
      </div>`;
  }

  const PREVIEW_COUNT = 3;

  // Horizontal scroll row with ‹ › side arrows (Netflix-style).
  // Wraps the grid in a positioned container and injects prev/next
  // buttons that scroll the row. Arrows show only when there's overflow.
  function applyPreview(gridId, linkId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // All cards visible (reachable via scroll)
    grid.querySelectorAll('.event-card').forEach(c => c.classList.remove('is-hidden-card'));

    // Hide the redundant "View All" text link — arrows handle navigation
    const link = document.getElementById(linkId);
    if (link) link.style.display = 'none';

    // Wrap the grid once in a .card-row-wrap so arrows can sit over it
    let wrap = grid.closest('.card-row-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'card-row-wrap';
      grid.parentNode.insertBefore(wrap, grid);
      wrap.appendChild(grid);

      const prev = document.createElement('button');
      prev.className = 'row-arrow row-arrow-prev';
      prev.setAttribute('aria-label', 'Scroll left');
      prev.innerHTML = '<i class="fas fa-chevron-left"></i>';

      const next = document.createElement('button');
      next.className = 'row-arrow row-arrow-next';
      next.setAttribute('aria-label', 'Scroll right');
      next.innerHTML = '<i class="fas fa-chevron-right"></i>';

      wrap.appendChild(prev);
      wrap.appendChild(next);

      const step = () => Math.max(grid.clientWidth * 0.85, 320);
      prev.addEventListener('click', () => grid.scrollBy({ left: -step(), behavior: 'smooth' }));
      next.addEventListener('click', () => grid.scrollBy({ left:  step(), behavior: 'smooth' }));

      const updateArrows = () => {
        const overflowing = grid.scrollWidth > grid.clientWidth + 8;
        const atStart = grid.scrollLeft <= 4;
        const atEnd   = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 4;
        prev.style.display = (overflowing && !atStart) ? '' : 'none';
        next.style.display = (overflowing && !atEnd)   ? '' : 'none';
      };
      grid.addEventListener('scroll', updateArrows, { passive: true });
      window.addEventListener('resize', updateArrows);
      wrap._updateArrows = updateArrows;
    }

    // Refresh arrow visibility after (re)render
    if (wrap._updateArrows) setTimeout(wrap._updateArrows, 60);
  }

  // Host-a-meet CTA card (kept at end of upcoming)
  function hostCard() {
    return `
      <div class="event-card host-card" data-name="Host an Event in TN" data-venue="Tamil Nadu">
        <div class="card-image">
          <div class="card-poster host-poster"><i class="fas fa-plus-circle"></i><span>Host an Event in TN</span></div>
          <div class="card-categories"><span class="cat-badge host-badge">Organiser</span></div>
        </div>
        <div class="card-body">
          <h3 class="card-event-title">Host Your Own Swimming Event</h3>
          <div class="card-info-list">
            <p><i class="fas fa-map-marker-alt"></i> <strong>Location:</strong> Tamil Nadu (Statewide)</p>
            <p><i class="fas fa-info-circle"></i> Create and manage your own competition with full tools.</p>
          </div>
          <div class="card-actions">
            <a href="orgcreate.html" class="btn-card btn-register">Create Event <i class="fas fa-arrow-right"></i></a>
          </div>
        </div>
      </div>`;
  }

  async function loadTournaments() {
    if (!window.sb) { console.warn('[SwimFest] Supabase not loaded — keeping static cards.'); return; }

    // Only show events for the currently selected state (mandatory filter)
    const selectedState = (localStorage.getItem('swimfest_state') || 'Tamil Nadu').trim();

    let query = window.sb.from('tournaments').select('*').order('start_date', { ascending: true });
    if (selectedState) query = query.eq('state', selectedState);
    const { data, error } = await query;

    if (error) { console.error('[SwimFest] tournaments load error:', error.message); return; }

    const rows = data || [];
    const upcoming = rows.filter(t => ['PUBLISHED','CLOSED','DRAFT','PENDING_APPROVAL'].includes(t.status) && t.status !== 'COMPLETED');
    const live     = rows.filter(t => t.status === 'LOCKED');
    const past     = rows.filter(t => t.status === 'COMPLETED');

    // Upcoming
    const upEl = document.getElementById('upcomingCards');
    if (upEl) {
      const cards = upcoming.filter(t => t.status !== 'DRAFT' && t.status !== 'PENDING_APPROVAL')
                            .map((t,i) => card(t, i, false));
      upEl.innerHTML = (cards.length ? cards.join('') : '') + hostCard();
      applyPreview('upcomingCards', 'viewAllUpcoming');
    }

    // Ongoing / Live
    const liveEl = document.getElementById('ongoingCards');
    if (liveEl) {
      if (live.length) {
        liveEl.innerHTML = live.map((t,i)=>card(t,i,false)).join('');
        applyPreview('ongoingCards', 'viewAllOngoing');
      } else {
        liveEl.innerHTML = `<div class="empty-state-inline"><i class="fas fa-info-circle"></i>
          <p>No live tournaments right now. Check the upcoming events above!</p></div>`;
        const l = document.getElementById('viewAllOngoing'); if (l) l.style.display = 'none';
      }
    }

    // Past
    const pastEl = document.getElementById('pastCards');
    if (pastEl) {
      if (past.length) {
        pastEl.innerHTML = past.map((t,i)=>card(t,i,true)).join('');
        applyPreview('pastCards', 'viewAllPast');
      } else {
        pastEl.innerHTML = `<div class="empty-state-inline"><i class="fas fa-info-circle"></i>
          <p>No archived events yet.</p></div>`;
        const l = document.getElementById('viewAllPast'); if (l) l.style.display = 'none';
      }
    }

    console.info(`[SwimFest] Loaded ${rows.length} tournaments for "${selectedState}" (${upcoming.length} upcoming, ${past.length} past).`);
  }

  // Expose so the state selector (script.js) can reload events on change
  window.loadTournaments = loadTournaments;

  // Apply the 3-card preview to whatever cards are present (covers the
  // static-HTML fallback when Supabase is unreachable). loadTournaments
  // re-applies it after the DB cards render.
  function initPreviews() {
    applyPreview('upcomingCards', 'viewAllUpcoming');
    applyPreview('ongoingCards',  'viewAllOngoing');
    applyPreview('pastCards',     'viewAllPast');
  }

  // Host "Create Event" card: require login before reaching orgcreate.
  // Delegated so it works for both static and DB-rendered host cards.
  function wireCreateEvent() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.host-card .btn-register, .host-card .btn-card');
      if (!link) return;
      e.preventDefault();
      showHostPrompt();
    });
  }

  // Confirmation popup: to host an event you must log in / sign up as an
  // organizer. OK → login page (with organizer signup pre-selected).
  function showHostPrompt() {
    // Remove any existing prompt first
    const old = document.getElementById('hostPromptOverlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'hostPromptOverlay';
    overlay.className = 'host-prompt-overlay';
    overlay.innerHTML = `
      <div class="host-prompt" role="dialog" aria-modal="true" aria-labelledby="hostPromptTitle">
        <div class="host-prompt-icon"><i class="fas fa-user-plus"></i></div>
        <h3 class="host-prompt-title" id="hostPromptTitle">Host an Event</h3>
        <p class="host-prompt-msg">To create and manage your own swimming event, please
          <strong>log in or sign up as an Organizer</strong>. Click OK to continue to the login page.</p>
        <div class="host-prompt-actions">
          <button class="host-prompt-btn host-prompt-cancel" type="button">Cancel</button>
          <button class="host-prompt-btn host-prompt-ok" type="button">OK</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const close = () => { overlay.remove(); document.body.style.overflow = ''; };
    const proceed = () => {
      // Organizer signup pre-selected on the login page; return to create flow after auth.
      window.location.href = 'login.html?returnTo=orgcreate.html&reason=organizer_required&as=organizer';
    };

    overlay.querySelector('.host-prompt-cancel').addEventListener('click', close);
    overlay.querySelector('.host-prompt-ok').addEventListener('click', proceed);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPreviews();
    wireCreateEvent();
    loadTournaments();
  });
})();
