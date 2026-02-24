const header = document.querySelector('.header');
const root = document.documentElement;

// Function to update header height CSS variable
function updateHeaderHeight() {
    const headerHeight = header.offsetHeight;
    root.style.setProperty('--header-height', `${headerHeight}px`);
}

// Update on page load
updateHeaderHeight();

// Update on scroll
let isScrolled = false;

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // hysteresys to prevent flickering when scrolling around the threshold
    if (!isScrolled && scrollTop > 60) {
        isScrolled = true;
        header.classList.add('header--scrolled');
        header.addEventListener('transitionend', updateHeaderHeight, { once: true });
    } else if (isScrolled && scrollTop < 10) {
        isScrolled = false;
        header.classList.remove('header--scrolled');
        header.addEventListener('transitionend', updateHeaderHeight, { once: true });
    }
    // In the dead zone (10–60px): do nothing
});

// Update on window resize
window.addEventListener('resize', updateHeaderHeight);

// Handle back-to-top button with proper offset
document.querySelector('.back-to-top')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});