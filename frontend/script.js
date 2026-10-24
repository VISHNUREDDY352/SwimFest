// ===== Indian States & Union Territories =====
const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli",
    "Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh",
    "Lakshadweep", "Puducherry"
];

// ===== DOM Elements =====
const stateSelector = document.getElementById('stateSelector');
const stateModal = document.getElementById('stateModal');
const modalClose = document.getElementById('modalClose');
const stateGrid = document.getElementById('stateGrid');
const currentStateEl = document.getElementById('currentState');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const logo = document.getElementById('logo');

// ===== Hero navbar: transparent over the image, solid on scroll =====
const heroNavbar = document.getElementById('navbar');
if (heroNavbar && heroNavbar.classList.contains('navbar-hero')) {
    const toggleNav = () => {
        // Turn solid once scrolled past most of the hero
        const threshold = Math.max(120, window.innerHeight * 0.6);
        heroNavbar.classList.toggle('scrolled', window.scrollY > threshold);
    };
    toggleNav();
    window.addEventListener('scroll', toggleNav, { passive: true });
    window.addEventListener('resize', toggleNav);
}
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');

// ===== How many meets each state has =====
async function getStateMeetCounts() {
    if (!window.sb) return {};
    try {
        const { data, error } = await window.sb
            .from('tournaments')
            .select('state')
            .in('status', ['PUBLISHED', 'CLOSED', 'LOCKED', 'COMPLETED']);
        if (error || !data) return {};
        const counts = {};
        data.forEach(t => {
            const st = (t.state || '').trim();
            if (st) counts[st] = (counts[st] || 0) + 1;
        });
        return counts;
    } catch (_) { return {}; }
}

// ===== State picker: search + states with meets first =====
let stateCounts = {};
const stateSearch = document.getElementById('stateSearch');

function chooseState(selected) {
    localStorage.setItem('swimfest_state', selected);
    currentStateEl.textContent = selected;
    const stateTag = document.querySelector('.state-tag');
    if (stateTag) stateTag.textContent = `(${selected})`;
    stateModal.classList.remove('active');
    // Reload the events for the newly selected state
    if (typeof window.loadTournaments === 'function') window.loadTournaments();
}

function renderStatePicker() {
    const saved = localStorage.getItem('swimfest_state');
    const q = (stateSearch ? stateSearch.value : '').trim().toLowerCase();
    const match = st => !q || st.toLowerCase().includes(q);
    const withMeets = states.filter(st => stateCounts[st] && match(st))
        .sort((a, b) => stateCounts[b] - stateCounts[a] || a.localeCompare(b));
    const others = states.filter(st => !stateCounts[st] && match(st));
    const btn = st => `<button type="button" class="state-option ${st === saved ? 'active' : ''}" data-state="${st}"${st === saved ? ' aria-current="true"' : ''}>
            <span>${st}</span>${stateCounts[st] ? `<small>${stateCounts[st]} meet${stateCounts[st] === 1 ? '' : 's'}</small>` : ''}
        </button>`;

    stateGrid.innerHTML = (withMeets.length ? `
        <p class="state-section-label">States with meets</p>
        <div class="state-list state-list-main">${withMeets.map(btn).join('')}</div>` : '')
        + (others.length ? `
        <p class="state-section-label">${withMeets.length ? 'Other states (no meets yet)' : 'All states'}</p>
        <div class="state-list state-list-other">${others.map(btn).join('')}</div>` : '')
        + (!withMeets.length && !others.length ? `<p class="state-empty">No state matches "${q.replace(/[<>&"]/g, '')}".</p>` : '');
}

async function initStateGrid() {
    stateCounts = await getStateMeetCounts();

    // Default: the saved state, else the state with the most meets, else Tamil Nadu
    let savedState = localStorage.getItem('swimfest_state');
    const busiest = Object.keys(stateCounts).sort((a, b) => stateCounts[b] - stateCounts[a])[0];
    if (!savedState || !states.includes(savedState)) savedState = busiest || 'Tamil Nadu';
    currentStateEl.textContent = savedState;
    localStorage.setItem('swimfest_state', savedState);
    const stateTag = document.querySelector('.state-tag');
    if (stateTag) stateTag.textContent = `(${savedState})`;

    renderStatePicker();

    // Ensure events match the finalized state (in case the default changed)
    if (typeof window.loadTournaments === 'function') window.loadTournaments();
}

stateGrid.addEventListener('click', e => {
    const option = e.target.closest('.state-option');
    if (option) chooseState(option.dataset.state);
});
if (stateSearch) {
    stateSearch.addEventListener('input', renderStatePicker);
    // Enter picks the first match
    stateSearch.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const first = stateGrid.querySelector('.state-option');
        if (first) chooseState(first.dataset.state);
    });
}

// ===== Search & Filter Logic =====
function filterTournaments() {
    const query = searchInput.value.toLowerCase().trim();
    const categoryVal = categoryFilter.value;
    const statusVal = statusFilter.value;

    const allCards = document.querySelectorAll('.event-card');

    allCards.forEach(card => {
        const name = (card.dataset.name || '').toLowerCase();
        const venue = (card.dataset.venue || '').toLowerCase();
        const categories = (card.dataset.categories || '').split(',');
        const status = card.dataset.status || '';

        // Text search: match name or venue
        let matchesSearch = true;
        if (query) {
            matchesSearch = name.includes(query) || venue.includes(query);
        }

        // Category filter
        let matchesCategory = true;
        if (categoryVal !== 'all') {
            matchesCategory = categories.includes(categoryVal);
        }

        // Status filter
        let matchesStatus = true;
        if (statusVal !== 'all') {
            matchesStatus = status === statusVal;
        }

        const visible = matchesSearch && matchesCategory && matchesStatus;
        card.classList.toggle('hidden', !visible);
    });
}

// ===== Event Listeners =====

// Search & Filters
searchInput.addEventListener('input', filterTournaments);
categoryFilter.addEventListener('change', filterTournaments);
statusFilter.addEventListener('change', filterTournaments);

// State selector modal
stateSelector.addEventListener('click', () => {
    stateModal.classList.add('active');
    if (stateSearch) {
        stateSearch.value = '';
        renderStatePicker();
        stateSearch.focus();
    }
});

modalClose.addEventListener('click', () => {
    stateModal.classList.remove('active');
});

stateModal.addEventListener('click', (e) => {
    if (e.target === stateModal) {
        stateModal.classList.remove('active');
    }
});

// Mobile menu toggle
mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
});

// Close mobile menu on link click
mobileMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
    });
});

// Logo click - scroll to top & reset
logo.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Keyboard - close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        stateModal.classList.remove('active');
        mobileMenu.classList.remove('active');
    }
});

// ===== Initialize =====
initStateGrid();
