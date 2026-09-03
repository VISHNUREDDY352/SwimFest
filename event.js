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

  const STATUS_LABEL = {
    PUBLISHED: 'Entries Open', CLOSED: 'Closing Soon', LOCKED: 'Live Now',
    COMPLETED: 'Completed', PENDING_APPROVAL: 'Pending Approval', DRAFT: 'Draft',
  };

  async function loadEvent() {
    if (!window.sb) return; // keep static content if DB unavailable
    const params = new URLSearchParams(location.search);
    const title = params.get('tournament');
    const id    = params.get('id');
    if (!title && !id) return; // no param — leave the default demo content

    let q = window.sb.from('tournaments').select('*');
    q = id ? q.eq('tournament_id', id) : q.eq('title', decodeURIComponent(title));
    const { data, error } = await q.limit(1).maybeSingle();
    if (error || !data) { console.warn('[SwimFest] event load:', error && error.message); return; }

    const t = data;
    setText('evTitle', t.title);
    if (t.host_organization) setText('evHostedBy', 'Hosted by: ' + t.host_organization);
    setText('evStatusBadge', STATUS_LABEL[t.status] || t.status);
    setText('evVenue', `${t.venue_name || ''}${t.city ? ', ' + t.city : ''}`);
    setText('evSpecs', `${t.pool_length || ''} | ${t.lane_count || 8} Lanes | Electronic Touch-Pad Ready`);
    setText('evDates', `${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}`);
    if (t.registration_deadline) setText('evDeadline', fmtDate(t.registration_deadline));

    // Point the register buttons at this tournament
    const regUrl = `register.html?tournament=${encodeURIComponent(t.title)}&from=event`;
    const btn  = document.getElementById('evRegisterBtn');
    const btnM = document.getElementById('evRegisterBtnMobile');
    const btnC = document.getElementById('evContinueBtn');
    if (btn)  btn.setAttribute('href', regUrl);
    if (btnM) btnM.setAttribute('href', regUrl);
    if (btnC) btnC.setAttribute('href', regUrl);

    document.title = `${t.title} | SwimFest`;
  }

  document.addEventListener('DOMContentLoaded', loadEvent);
})();
