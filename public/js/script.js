// Global state
let books = [];
let config = {};
let activeTag = null;
let activeRating = null;

// DOM elements
const booksGrid = document.getElementById('booksGrid');
const searchInput = document.getElementById('searchInput');
const tagsContainer = document.getElementById('filter-tags');
const ratingFilters = document.querySelectorAll('.rating-filter');
const visibleCount = document.getElementById('visibleCount');
const totalCount = document.getElementById('totalCount');
const noResults = document.getElementById('noResults');

// Advanced sorting function that can handle multiple properties and sort directions
const advancedSort = (props) => {
    return (a, b) => {
        for (let prop of props) {
            let desc = false;
            if (prop.startsWith("-")) {
                desc = true;
                prop = prop.substr(1);
            }

            const valA = String(a[prop] || "");
            const valB = String(b[prop] || "");

            const comparison = valA.localeCompare(valB, undefined, {
                numeric: true,
                sensitivity: 'base'
            });

            if (comparison !== 0) {
                return desc ? comparison * -1 : comparison;
            }
        }
        return 0;
    };
};

// Load data on page load — now from the API
async function loadData() {
    try {
        const [booksResponse, configResponse] = await Promise.all([
            fetch('/api/books'),
            fetch('/api/config')
        ]);

        if (!booksResponse.ok) throw new Error(`Books API: ${booksResponse.status}`);
        if (!configResponse.ok) throw new Error(`Config API: ${configResponse.status}`);

        books = await booksResponse.json();
        books = books.sort(advancedSort(['titolo', 'volume']));
        config = await configResponse.json();

        // Expose shared state for editor.js
        window._books = books;
        window._config = config;
        window._filterBooks = filterBooks;

        initializeFilters();
        renderBooks(books);
        editor.init();
    } catch (error) {
        console.error('Error loading data:', error);
        booksGrid.innerHTML = '<p style="text-align: center; color: var(--color-primary);">Errore nel caricamento dei dati.</p>';
    }
}

// Initialize filter buttons from config
function initializeFilters() {
    totalCount.textContent = books.length;

    tagsContainer.innerHTML = config.tags.map(tag =>
        `<button class="tag-filter" data-tag="${tag.label}">${tag.label}</button>`
    ).join('');
}

// Render books to the grid
function renderBooks(filteredBooks) {
    booksGrid.innerHTML = '';

    if (filteredBooks.length === 0) {
        booksGrid.style.display = 'none';
        noResults.style.display = 'block';
    } else {
        booksGrid.style.display = 'grid';
        noResults.style.display = 'none';

        filteredBooks.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card';
            card.dataset.bookId = book.id;  // needed by editor.js overlays

            const volumeDisplay = book.volume ? `<div class="book-volume">${book.volume}</div>` : '';
            const ratingStars = getRatingStars(book.rating);

            // add "copie" tag if there are multiple copies
            const displayTags = [...(book.tags ?? [])];
            if (book.copie > 1 && !displayTags.some(tag => tag.includes("copie"))) {
                displayTags.push(`${book.copie} copie`);
            }

            const tagsHtml = displayTags.length > 0 ?
                `<div class="book-tags">${displayTags.map(tag => `<span class="${tag.includes("copie") ? "copies-tag" : "tag"}">${tag}</span>`).join('')}</div>` : '';

            card.innerHTML = `
                <div class="book-header">
                    <div class="book-series">${book.titolo}</div>
                    ${ratingStars}
                </div>
                ${volumeDisplay}
                <div class="book-meta">
                    ${book.autori ? `<div class="meta-row"><span class="meta-label">Autori:</span><span class="meta-value">${book.autori}</span></div>` : ''}
                    ${book.editore ? `<div class="meta-row"><span class="meta-label">Editore:</span><span class="meta-value">${book.editore}</span></div>` : ''}
                    ${book.data ? `<div class="meta-row"><span class="meta-label">Anno:</span><span class="meta-value">${book.data}</span></div>` : ''}
                </div>
                ${tagsHtml}
            `;

            booksGrid.appendChild(card);
        });
    }

    visibleCount.textContent = filteredBooks.length;

    // Attach hover overlays after each render
    if (typeof editor !== 'undefined') {
        editor.attachOverlays();
    }
}

// Generate star rating HTML
function getRatingStars(rating) {
    if (!rating) return '';

    const stars = [];
    for (let i = 0; i < 3; i++) {
        stars.push(i < rating
            ? '<span class="star star--filled">★</span>'
            : '<span class="star star--empty">☆</span>'
        );
    }

    return `<div class="book-rating">${stars.join('')}</div>`;
}

// Filter books based on all active filters
function filterBooks() {
    const searchTokens = searchInput.value.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    let filtered = books.filter(book => {
        const matchesSearch = searchTokens.every(token =>
            book.titolo.toLowerCase().includes(token) ||
            (book.volume && book.volume.toLowerCase().includes(token)) ||
            (book.autori && book.autori.toLowerCase().includes(token)) ||
            (book.editore && book.editore.toLowerCase().includes(token)) ||
            (book.data && book.data.toLowerCase().includes(token)) ||
            (book.tags && book.tags.some(tag => tag.toLowerCase().includes(token)))
        );

        const matchesTag = !activeTag || book.tags.includes(activeTag);
        const matchesRating = !activeRating || book.rating === activeRating;

        return matchesSearch && matchesTag && matchesRating;
    });

    renderBooks(filtered);
}

// Event listeners
searchInput.addEventListener('input', filterBooks);

tagsContainer.addEventListener('click', (e) => {
    const tagFilterButtons = document.querySelectorAll('.tag-filter');
    const button = e.target.closest('.tag-filter');
    if (!button) return;

    const tag = button.dataset.tag;
    if (activeTag === tag) {
        activeTag = null;
        button.classList.remove('active');
    } else {
        tagFilterButtons.forEach(b => b.classList.remove('active'));
        activeTag = tag;
        button.classList.add('active');
    }

    button.blur();
    filterBooks();
});

ratingFilters.forEach(button => {
    button.addEventListener('click', () => {
        const rating = parseInt(button.dataset.rating);

        if (activeRating === rating) {
            activeRating = null;
            button.classList.remove('active');
        } else {
            ratingFilters.forEach(b => b.classList.remove('active'));
            activeRating = rating;
            button.classList.add('active');
        }

        button.blur();
        filterBooks();
    });
});

// ── Startup status ──────────────────────────────────────────────────────────

async function checkStartupStatus() {
    try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const status = await res.json();
        if (!status.checked) return;
        if (!status.success) {
            notify.warn('Sincronizzazione iniziale non riuscita.', {
                duration: 0,
                detail: status.error ?? 'I dati locali potrebbero non essere aggiornati. Riavvia l\'app dopo aver risolto il conflitto.',
            });
        }
    } catch { /* silent */ }
}

// Initialize on page load
checkStartupStatus();
loadData();