// ===== Event Page: Sub-Navigation Tab Switching =====
const subNavTabs = document.querySelectorAll('.sub-nav-tab');
const tabContents = document.querySelectorAll('.tab-content');

subNavTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        // Remove active from all tabs
        subNavTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Activate clicked tab
        tab.classList.add('active');
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
    });
});

// ===== Mobile Menu Toggle =====
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
    });

    mobileMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
        });
    });
}

// ===== Keyboard: Escape to close mobile menu =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu) {
        mobileMenu.classList.remove('active');
    }
});

/* ============================================================
   Load a real tournament from Supabase by ?tournament=<title>
   or ?id=<uuid> and populate the event detail page.
   ============================================================ */
(function () {
  'use strict';

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function setText(id, txt) { const el = document.getElementById(id); if (el && txt) el.textContent = txt; }
  function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  const STATUS_LABEL = {
    PUBLISHED: 'Entries Open', CLOSED: 'Closing Soon', LOCKED: 'Live Now',
    COMPLETED: 'Completed', PENDING_APPROVAL: 'Pending Approval', DRAFT: 'Draft',
  };

  async function loadEvent() {
    const params = new URLSearchParams(location.search);
    const title = params.get('tournament');
    const id    = params.get('id');
    if (!title && !id) return; // no param — leave the default demo content

    // Immediately blank the hardcoded default so the wrong event
    // (e.g. "Golden Non-Medalist") never flashes before the real one loads.
    const prettyTitle = title ? decodeURIComponent(title) : 'Loading…';
    setText('evTitle', prettyTitle);
    setText('evBannerTitle', prettyTitle);
    ['evHostedBy','evVenue','evSpecs','evDates','evDeadline','evBaseFee','evFeeLine','evMobileFee','evSwimUpLine','evRelayFee','evRelayFeeSidebar']
      .forEach(id2 => { const el = document.getElementById(id2); if (el) el.textContent = '…'; });

    if (!window.sb) return; // keep placeholder if DB unavailable

    let q = window.sb.from('tournaments').select('*');
    q = id ? q.eq('tournament_id', id) : q.eq('title', decodeURIComponent(title));
    const { data, error } = await q.limit(1).maybeSingle();
    if (error || !data) { console.warn('[SwimFest] event load:', error && error.message); return; }

    const t = data;
    setText('evTitle', t.title);
    setText('evBannerTitle', t.title);
    if (t.host_organization) setText('evHostedBy', 'Hosted by: ' + t.host_organization);
    // Badge from the meet's dates and the clock, not just its stored status
    const MS = window.SwimMeetState;
    const badge = MS ? MS.badge(t) : { label: STATUS_LABEL[t.status] || t.status, cls: 'status-open' };
    setText('evStatusBadge', badge.label);
    const badgeEl = document.getElementById('evStatusBadge');
    if (badgeEl) badgeEl.className = `event-status-badge ${badge.cls}`;
    setText('evVenue', `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`);
    const pools = Array.isArray(t.pool_lengths) && t.pool_lengths.length ? t.pool_lengths : [t.pool_length || '50m'];
    setText('evSpecs', `${pools.map(p => p === '25m' ? '25 m' : '50 m').join(' + ')} pool${pools.length > 1 ? 's' : ''} | ${t.lane_count || 8} lanes`);
    setText('evResultsNote', `Results will be published live during the event (${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}).`);

    // Poster uploaded by the organizer
    const poster = document.getElementById('evPoster');
    if (poster && t.poster_url) { poster.src = t.poster_url; poster.alt = `${t.title} poster`; poster.hidden = false; }

    // Races the organizer switched on (older meets have no list yet)
    const raceBody = document.getElementById('evEventsTableBody');
    if (raceBody && Array.isArray(t.events_offered) && t.events_offered.length) {
      raceBody.innerHTML = t.events_offered.map((name, i) => {
        const m = /^(\d+)m\s+(.+)$/.exec(name) || [];
        return `<tr><td>${i + 1}</td><td>${escHtml(m[2] || name)}</td><td>${m[1] ? m[1] + ' m' : '—'}</td></tr>`;
      }).join('');
    }
    setText('evDates', `${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}`);
    if (t.registration_deadline) setText('evDeadline', fmtDate(t.registration_deadline));

    // Fees + rules
    const fee = money(t.reg_fee_amount);
    setText('evBaseFee', fee);
    setText('evFeeLine', fee);
    setText('evMobileFee', `${fee} (${t.max_individual_events || 3} Events)`);

    // Relay add-on fee (hide the row when the meet has no relay fee)
    const relayAmt = t.relay_add_on_fee != null ? money(t.relay_add_on_fee) : null;
    setText('evRelayFee', relayAmt || '—');
    setText('evRelayFeeSidebar', relayAmt || '—');
    if (!relayAmt) {
      const relayLine = document.getElementById('evRelayLine');
      if (relayLine) relayLine.style.display = 'none';
    }
    setText('evSwimUpLine', t.allow_swim_up
      ? 'SWIM-UP ENABLED (compete in next age group allowed)'
      : 'SINGLE CATEGORY ONLY (Swim-Up disabled for this meet)');

    // Point the register buttons at this tournament
    const regUrl = `register.html?t=${encodeURIComponent(t.tournament_id)}&from=event`;
    const btn  = document.getElementById('evRegisterBtn');
    const btnM = document.getElementById('evRegisterBtnMobile');
    const btnC = document.getElementById('evContinueBtn');
    if (btn)  btn.setAttribute('href', regUrl);
    if (btnM) btnM.setAttribute('href', regUrl);
    if (btnC) btnC.setAttribute('href', regUrl);

    // Entries closed (deadline passed, racing started or finished): no Register buttons
    if (MS && !MS.entriesOpen(t)) {
      const phase = MS.phase(t);
      const why = phase === 'past' ? 'Meet finished' : phase === 'ongoing' ? 'Racing now · entries closed' : 'Entries closed';
      [btn, btnM, btnC].forEach(b => {
        if (!b) return;
        b.removeAttribute('href');
        b.setAttribute('aria-disabled', 'true');
        b.style.cssText += ';opacity:0.55;pointer-events:none;cursor:default;';
        b.innerHTML = `<i class="fas fa-lock"></i> ${why}`;
      });
    }

    document.title = `${t.title} | SwimFest`;

    // Racing (or finished): link to the public live timing board
    const live = document.getElementById('evLiveBtn');
    const phaseNow = MS ? MS.phase(t) : null;
    const racing = ['LOCKED', 'CLOSURE_REQUESTED'].includes(t.status);
    if (live && (phaseNow === 'ongoing' || phaseNow === 'past' || racing)) {
      live.href = `live.html?t=${encodeURIComponent(t.tournament_id)}`;
      if (phaseNow === 'past') document.getElementById('evLiveText').textContent = 'Official results';
      live.hidden = false;
      live.style.display = 'inline-flex';
    }

    // Results tab: ranked results per race once racing has started
    if (window.SwimResults) window.SwimResults.load(t);
  }

  document.addEventListener('DOMContentLoaded', loadEvent);
})();
