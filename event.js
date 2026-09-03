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
