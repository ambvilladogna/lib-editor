/**
 * store.js — Shared application state
 *
 * A plain-object store holding the catalogue data and mutation helpers.
 * Both script.js and editor.js import from here instead of reading/writing
 * window._books / window._config / window._filterBooks directly.
 *
 * Subscribers register via store.onChange(fn) and are notified after every
 * mutation, so any module can react to state changes without tight coupling.
 *
 * Public API:
 *   store.books                    → Book[]  (read-only via getter)
 *   store.config                   → Config  (read-only via getter)
 *   store.setBooks(books)          → replaces the array, notifies
 *   store.setConfig(config)        → replaces config, notifies
 *   store.upsertBook(book)         → insert or update by id, notifies
 *   store.removeBook(id)           → remove by id, notifies
 *   store.onChange(fn)             → subscribe; returns unsubscribe fn
 *   store.filterBooks()            → trigger re-render (set by script.js)
 */

const store = (() => {

  // ── Private state ──────────────────────────────────────────────────────────

  let _books = [];
  let _config = { tags: [], ratings: [] };
  let _filterBooks = () => { };           // injected by script.js after init
  const _subscribers = new Set();

  // ── Notification ───────────────────────────────────────────────────────────

  function _notify() {
    for (const fn of _subscribers) fn();
  }

  // ── Sorting helper (same logic as script.js / editor.js) ──────────────────

  function _sort(arr) {
    return arr.slice().sort((a, b) =>
      String(a.titolo ?? '').localeCompare(String(b.titolo ?? ''), undefined, { numeric: true, sensitivity: 'base' }) ||
      String(a.volume ?? '').localeCompare(String(b.volume ?? ''), undefined, { numeric: true, sensitivity: 'base' })
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {

    // ── Getters ────────────────────────────────────────────────────────────────

    get books() { return _books; },
    get config() { return _config; },

    // ── Bulk setters (used by loadData in script.js) ───────────────────────────

    setBooks(books) {
      _books = _sort(books);
      _notify();
    },

    setConfig(config) {
      _config = config;
      _notify();
    },

    // ── Fine-grained book mutations (used by editor.js) ────────────────────────

    /** Insert a new book, or replace an existing one with the same id. */
    upsertBook(book) {
      const idx = _books.findIndex(b => b.id === book.id);
      if (idx === -1) {
        _books = _sort([..._books, book]);
      } else {
        _books = _books.slice();
        _books[idx] = book;
      }
      _notify();
    },

    /** Remove the book with the given id. */
    removeBook(id) {
      _books = _books.filter(b => b.id !== id);
      _notify();
    },

    /** Restore a book at a specific index (used by delete-undo). */
    restoreBook(book, atIndex) {
      _books = _books.slice();
      _books.splice(atIndex, 0, book);
      _notify();
    },

    /** Returns the current index of a book (needed for restore). */
    indexOfBook(id) {
      return _books.findIndex(b => b.id === id);
    },

    // ── Filter bridge (injected by script.js) ─────────────────────────────────

    /** script.js calls this once after init to register the render function. */
    setFilterFn(fn) {
      _filterBooks = fn;
    },

    /** Trigger a re-render with current filter state. */
    filterBooks() {
      _filterBooks();
    },

    // ── Subscriptions ──────────────────────────────────────────────────────────

    /**
     * Register a callback to be called after any state mutation.
     * Returns an unsubscribe function.
     */
    onChange(fn) {
      _subscribers.add(fn);
      return () => _subscribers.delete(fn);
    },
  };

})();