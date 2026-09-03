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
      PUBLISHED: { cls:'status-open', label:'Entries Open' },
      CLOSED:    { cls:'status-closing-soon', label:'Closing Soon' },
      LOCKED:    { cls:'status-live', label:'Live Now' },
      COMPLETED: { cls:'status-completed', label:'Completed' },
    };
    const st = statusMap[t.status] || statusMap.PUBLISHED;
    const regParam = encodeURIComponent(t.title);

    const catBadges = ['U10','U12','U14','U16'].map(c => `<span class="cat-badge">${c}</span>`).join('');

    if (isPast) {
      return `
      <div class="event-card past-card" data-name="${esc(t.title)}" data-venue="${esc(t.venue_name)}">
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
      <div class="event-card" data-name="${esc(t.title)}" data-venue="${esc(t.venue_name)}">
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
            <a href="event.html" class="btn-card btn-details">View Tournament Details</a>
            <a href="register.html?tournament=${regParam}&from=event" class="btn-card btn-register">Register Now <i class="fas fa-arrow-right"></i></a>
          </div>
        </div>
      </div>`;
  }

  const PREVIEW_COUNT = 3;

  // Limit a card grid to PREVIEW_COUNT tournament cards and wire its
  // "View All" toggle. The host CTA card (.host-card) never counts and
  // stays visible. The link auto-hides when there are <= PREVIEW_COUNT.
  function applyPreview(gridId, linkId) {
    const grid = document.getElementById(gridId);
    const link = document.getElementById(linkId);
    if (!grid || !link) return;

    // Only real tournament cards count (exclude host CTA + empty states)
    const cards = Array.from(grid.querySelectorAll('.event-card:not(.host-card)'));

    if (cards.length <= PREVIEW_COUNT) {
      link.style.display = 'none';
      cards.forEach(c => c.classList.remove('is-hidden-card'));
      return;
    }

    link.style.display = '';

    // Replace the node to clear any listeners bound on a previous run
    const fresh = link.cloneNode(true);
    link.parentNode.replaceChild(fresh, link);

    let expanded = false;
    const paint = () => {
      cards.forEach((c, i) => c.classList.toggle('is-hidden-card', !expanded && i >= PREVIEW_COUNT));
      fresh.innerHTML = expanded
        ? 'Show Less <i class="fas fa-arrow-up"></i>'
        : 'View All <i class="fas fa-arrow-right"></i>';
    };

    paint(); // initial: collapsed, hide cards past the 3rd

    fresh.addEventListener('click', (e) => {
      e.preventDefault();
      expanded = !expanded;
      paint();
      const section = grid.closest('.section');
      if (!expanded && section) section.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Host-a-meet CTA card (kept at end of upcoming)
  function hostCard() {
    return `
      <div class="event-card host-card" data-name="Host a Meet in TN" data-venue="Tamil Nadu">
        <div class="card-image">
          <div class="card-poster host-poster"><i class="fas fa-plus-circle"></i><span>Host a Meet in TN</span></div>
          <div class="card-categories"><span class="cat-badge host-badge">Organiser</span></div>
        </div>
        <div class="card-body">
          <h3 class="card-event-title">Host Your Own Swimming Meet</h3>
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

    const { data, error } = await window.sb
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) { console.error('[SwimFest] tournaments load error:', error.message); return; }
    if (!data || !data.length) { console.info('[SwimFest] no tournaments in DB — keeping static cards.'); return; }

    const upcoming = data.filter(t => ['PUBLISHED','CLOSED','DRAFT','PENDING_APPROVAL'].includes(t.status) && t.status !== 'COMPLETED');
    const live     = data.filter(t => t.status === 'LOCKED');
    const past     = data.filter(t => t.status === 'COMPLETED');

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

    console.info(`[SwimFest] Loaded ${data.length} tournaments from Supabase (${upcoming.length} upcoming, ${past.length} past).`);
  }

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
      const loggedIn = window.SwimAuth && window.SwimAuth.isLoggedIn();
      if (loggedIn) {
        window.location.href = 'orgcreate.html';
      } else {
        window.location.href = 'login.html?returnTo=orgcreate.html&reason=login_required';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPreviews();
    wireCreateEvent();
    loadTournaments();
  });
})();
