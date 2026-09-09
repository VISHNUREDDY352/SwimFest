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
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');

// ===== Fetch the states that actually host tournaments =====
async function getActiveStates() {
    // Only show states that have at least one visible tournament.
    if (!window.sb) return null;
    try {
        const { data, error } = await window.sb
            .from('tournaments')
            .select('state')
            .in('status', ['PUBLISHED', 'CLOSED', 'LOCKED', 'COMPLETED']);
        if (error || !data) return null;
        const distinct = [...new Set(data.map(t => (t.state || '').trim()).filter(Boolean))].sort();
        return distinct.length ? distinct : null;
    } catch (_) { return null; }
}

// ===== Initialize State Grid (auto-populated from active states) =====
async function initStateGrid() {
    // Auto-populate from states that have events; fall back to full list.
    const activeStates = await getActiveStates();
    const list = activeStates || states;

    // Default selection: saved state if it's active, else the first active state
    let savedState = localStorage.getItem('swimfest_state');
    if (!savedState || !list.includes(savedState)) savedState = list[0] || 'Tamil Nadu';
    currentStateEl.textContent = savedState;
    localStorage.setItem('swimfest_state', savedState);
    const stateTag = document.querySelector('.state-tag');
    if (stateTag) stateTag.textContent = `(${savedState})`;

    stateGrid.innerHTML = list.map(state => `
        <div class="state-option ${state === savedState ? 'active' : ''}" data-state="${state}">
            ${state}
        </div>
    `).join('');

    // Add click handlers to state options
    stateGrid.querySelectorAll('.state-option').forEach(option => {
        option.addEventListener('click', () => {
            const selected = option.dataset.state;
            localStorage.setItem('swimfest_state', selected);
            currentStateEl.textContent = selected;
            
            // Update active state
            stateGrid.querySelectorAll('.state-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            
            // Update section title
            const stateTag = document.querySelector('.state-tag');
            if (stateTag) stateTag.textContent = `(${selected})`;

            // Close modal
            stateModal.classList.remove('active');
        });
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
