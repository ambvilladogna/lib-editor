// Filter state — local to script.js
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

// ── Data loading ────────────────────────────────────────────────────────────

async function loadData() {
    try {
        const [booksResponse, configResponse] = await Promise.all([
            fetch('/api/books'),
            fetch('/api/config')
        ]);

        if (!booksResponse.ok) throw new Error(`Books API: ${booksResponse.status}`);
        if (!configResponse.ok) throw new Error(`Config API: ${configResponse.status}`);

        store.setBooks(await booksResponse.json());
        store.setConfig(await configResponse.json());

        // Register filterBooks as the store's render trigger
        store.setFilterFn(filterBooks);

        initializeFilters();
        filterBooks();
        editor.init();
        tags.init();   // builds the tag panel DOM (hidden until opened)
        _buildManageTagsLink();
        sync.init();   // appends sync widget to .header__nav
        quit.init();   // appends quit button to .header__nav (after sync widget)

        // Re-render tag filter buttons whenever config changes (tag add/rename/delete)
        store.onChange(() => {
            _refreshTagFilters();
            // store.filterBooks();
        });

    } catch (error) {
        console.error('Error loading data:', error);
        booksGrid.innerHTML = '<p style="text-align: center; color: var(--color-primary);">Errore nel caricamento dei dati.</p>';
    }
}

// ── Filter UI initialisation ────────────────────────────────────────────────

function initializeFilters() {
    totalCount.textContent = store.books.length;
    _refreshTagFilters();
}

/**
 * Rebuilds the tag filter buttons from current store.config.
 * Called on initial load and after any tag mutation.
 */
function _refreshTagFilters() {
    tagsContainer.innerHTML = '';

    (store.config?.tags ?? []).forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'tag-filter' + (activeTag === tag.label ? ' active' : '');
        btn.dataset.tag = tag.label;
        btn.textContent = tag.label;
        tagsContainer.appendChild(btn);
    });

    // If the previously active tag no longer exists, clear it
    if (activeTag && !(store.config?.tags ?? []).some(t => t.label === activeTag)) {
        activeTag = null;
        filterBooks();
    }
}

/**
 * Appends the "Gestisci tag ✎" link right after the tag filter buttons.
 * Placed inside .filter-group (parent of #filter-tags).
 */
function _buildManageTagsLink() {
    const filterGroup = tagsContainer.closest('.filter-group');
    if (!filterGroup) return;

    const link = document.createElement('button');
    link.className = 'tags-manage-link';
    link.setAttribute('aria-label', 'Gestisci le categorie del catalogo');
    link.innerHTML = '✎ <span>Gestisci</span>';
    link.addEventListener('click', () => tags.open());
    filterGroup.appendChild(link);
}

// ── Render ──────────────────────────────────────────────────────────────────

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
            card.dataset.bookId = book.id;

            const volumeDisplay = book.volume
                ? `<div class="book-volume">${book.volume}</div>`
                : '';

            const ratingStars = getRatingStars(book.rating);

            const displayTags = [...(book.tags ?? [])];
            if (book.copie > 1 && !displayTags.some(tag => tag.includes('copie'))) {
                displayTags.push(`${book.copie} copie`);
            }

            const tagsHtml = displayTags.length > 0
                ? `<div class="book-tags">${displayTags.map(tag =>
                    `<span class="${tag.includes('copie') ? 'copies-tag' : 'tag'}">${tag}</span>`
                ).join('')}</div>`
                : '';

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
    totalCount.textContent = store.books.length;

    if (typeof editor !== 'undefined') {
        editor.attachOverlays();
    }
}

// ── Star rating ─────────────────────────────────────────────────────────────

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

// ── Filtering ────────────────────────────────────────────────────────────────

function filterBooks() {
    const searchTokens = searchInput.value.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    const filtered = store.books.filter(book => {
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

// ── Event listeners ──────────────────────────────────────────────────────────

searchInput.addEventListener('input', filterBooks);

// Tag filter clicks — delegated because buttons are rebuilt on config change
tagsContainer.addEventListener('click', (e) => {
    const button = e.target.closest('.tag-filter');
    if (!button) return;

    const tag = button.dataset.tag;
    if (activeTag === tag) {
        activeTag = null;
        button.classList.remove('active');
    } else {
        tagsContainer.querySelectorAll('.tag-filter').forEach(b => b.classList.remove('active'));
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

// ── Startup status ───────────────────────────────────────────────────────────

async function checkStartupStatus() {
    try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.checked) return;
        if (!data.success) {
            notify.warn('Sincronizzazione iniziale non riuscita.', {
                duration: 0,
                detail: data.error ?? 'I dati locali potrebbero non essere aggiornati. Riavvia l\'app dopo aver risolto il conflitto.',
            });
        }
    } catch { /* silent */ }
}

// ── Startup ──────────────────────────────────────────────────────────────────

checkStartupStatus();
loadData();