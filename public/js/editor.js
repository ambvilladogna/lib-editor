/**
 * editor.js — Book management UI
 *
 * Provides:
 *  - Hover overlay on each card (Edit · Delete · Duplicate)
 *  - Slide-in panel for create / edit (all fields, star picker, tag multi-select)
 *  - FAB to create a new book
 *  - Delete with undo via notify.js toast
 *
 * Depends on:
 *  - notify.js  (must be loaded first)
 *  - The global `books` and `config` arrays from script.js
 *  - `renderBooks()` and `filterBooks()` from script.js (called after mutations)
 *
 * Public API (attached to window):
 *  editor.openNew()
 *  editor.openEdit(bookId)
 *  editor.openDuplicate(bookId)
 *  editor.deleteBook(bookId)
 */

const editor = (() => {

  // ── State ─────────────────────────────────────────────────────────────────

  let panelMode = null;      // 'create' | 'edit' | 'duplicate'
  let editingId = null;      // book id being edited (null for new)
  let pendingDelete = null;  // { book, undoToastId } — for undo support

  // ── DOM references (created once in init) ────────────────────────────────

  let backdrop, panel, panelTitle, panelSubtitle, panelBody, saveBtn;

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  function init() {
    _buildPanel();
    _buildFab();
  }

  // ── Panel construction ────────────────────────────────────────────────────

  function _buildPanel() {
    // Backdrop
    backdrop = document.createElement('div');
    backdrop.className = 'panel-backdrop';
    backdrop.addEventListener('click', closePanel);
    document.body.appendChild(backdrop);

    // Panel shell
    panel = document.createElement('div');
    panel.className = 'editor-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'panel-title-el');

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';

    const titleBlock = document.createElement('div');
    panelTitle = document.createElement('div');
    panelTitle.className = 'panel-title';
    panelTitle.id = 'panel-title-el';
    panelSubtitle = document.createElement('div');
    panelSubtitle.className = 'panel-subtitle';
    titleBlock.appendChild(panelTitle);
    titleBlock.appendChild(panelSubtitle);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'panel-close';
    closeBtn.setAttribute('aria-label', 'Chiudi pannello');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closePanel);

    header.appendChild(titleBlock);
    header.appendChild(closeBtn);

    // Body (form injected dynamically)
    panelBody = document.createElement('div');
    panelBody.className = 'panel-body';

    // Footer
    const footer = document.createElement('div');
    footer.className = 'panel-footer';

    saveBtn = document.createElement('button');
    saveBtn.className = 'btn-panel-save';
    saveBtn.textContent = 'Salva';
    saveBtn.addEventListener('click', _handleSave);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-panel-cancel';
    cancelBtn.textContent = 'Annulla';
    cancelBtn.addEventListener('click', closePanel);

    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);

    panel.appendChild(header);
    panel.appendChild(panelBody);
    panel.appendChild(footer);
    document.body.appendChild(panel);

    // Keyboard: Escape closes panel
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('editor-panel--open')) {
        closePanel();
      }
    });
  }

  function _buildFab() {
    const fab = document.createElement('button');
    fab.className = 'fab-new-book';
    fab.setAttribute('aria-label', 'Nuovo testo');
    fab.textContent = '+';
    fab.addEventListener('click', openNew);
    document.body.appendChild(fab);
  }

  // ── Panel open/close ──────────────────────────────────────────────────────

  function _openPanel(mode, book = null) {
    panelMode = mode;
    editingId = (mode === 'edit') ? book.id : null;

    // Header text
    if (mode === 'create') {
      panelTitle.textContent = 'Nuovo testo';
      panelSubtitle.textContent = 'Aggiungi un nuovo testo al catalogo';
    } else if (mode === 'edit') {
      panelTitle.textContent = 'Modifica testo';
      panelSubtitle.textContent = book.titolo;
    } else {
      panelTitle.textContent = 'Duplica testo';
      panelSubtitle.textContent = `Copia di: ${book.titolo}`;
    }

    // Build form
    panelBody.innerHTML = '';
    panelBody.appendChild(_buildForm(book));

    // Animate open
    backdrop.classList.add('panel-backdrop--visible');
    panel.classList.add('editor-panel--open');

    // Focus first input
    requestAnimationFrame(() => {
      const first = panelBody.querySelector('input, textarea');
      first?.focus();
    });
  }

  function closePanel() {
    backdrop.classList.remove('panel-backdrop--visible');
    panel.classList.remove('editor-panel--open');
    panelMode = null;
    editingId = null;
  }

  // ── Form builder ──────────────────────────────────────────────────────────

  function _buildForm(book = null) {
    const form = document.createElement('div');
    form.id = 'book-form';

    // Helper: create a labelled field wrapper
    function field(labelText, required, ...inputs) {
      const wrap = document.createElement('div');
      wrap.className = 'form-field';
      const lbl = document.createElement('label');
      lbl.className = 'form-label' + (required ? ' form-label--required' : '');
      lbl.textContent = labelText;
      wrap.appendChild(lbl);
      inputs.forEach(i => wrap.appendChild(i));
      return wrap;
    }

    function input(name, value = '', type = 'text', placeholder = '') {
      const el = document.createElement('input');
      el.type = type;
      el.className = 'form-input';
      el.name = name;
      el.value = value ?? '';
      el.placeholder = placeholder;
      return el;
    }

    // ── Titolo (required) ────────────────────────────────────────────────
    const titoloInput = input('titolo', book?.titolo, 'text', 'Titolo della pubblicazione');
    form.appendChild(field('Titolo', true, titoloInput));

    // ── Volume ───────────────────────────────────────────────────────────
    const volumeInput = input('volume', book?.volume, 'text', 'es. Vol. 1, Parte II…');
    form.appendChild(field('Volume / Sottotitolo', false, volumeInput));

    // ── Autori ───────────────────────────────────────────────────────────
    const autoriInput = input('autori', book?.autori, 'text', 'Nome Cognome, Nome Cognome');
    form.appendChild(field('Autori', false, autoriInput));

    // ── Editore + Anno (row) ──────────────────────────────────────────────
    const editoreInput = input('editore', book?.editore, 'text', 'Casa editrice');
    const dataInput = input('data', book?.data, 'text', 'AAAA');
    dataInput.maxLength = 4;
    dataInput.style.width = '100%';

    const row = document.createElement('div');
    row.className = 'form-field--row';
    row.appendChild(field('Editore', false, editoreInput));
    row.appendChild(field('Anno', false, dataInput));
    form.appendChild(row);

    // ── Copie ────────────────────────────────────────────────────────────
    const copieInput = input('copie', book?.copie ?? 1, 'number', '1');
    copieInput.min = 1;
    form.appendChild(field('Copie', false, copieInput));

    // ── Rating (star picker) ─────────────────────────────────────────────
    let currentRating = book?.rating ?? 0;

    const starPicker = document.createElement('div');
    starPicker.className = 'star-picker';
    starPicker.setAttribute('role', 'group');
    starPicker.setAttribute('aria-label', 'Valutazione (1-3 stelle)');

    const stars = [1, 2, 3].map(v => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-picker__star' + (v <= currentRating ? ' star-picker__star--active' : '');
      btn.textContent = '★';
      btn.setAttribute('aria-label', `${v} ${v === 1 ? 'stella' : 'stelle'}`);
      btn.addEventListener('click', () => {
        currentRating = (currentRating === v) ? 0 : v; // toggle off if same
        _updateStars(stars, currentRating);
      });
      return btn;
    });

    const clearStar = document.createElement('button');
    clearStar.type = 'button';
    clearStar.className = 'star-picker__clear';
    clearStar.textContent = 'nessuna';
    clearStar.setAttribute('aria-label', 'Rimuovi valutazione');
    clearStar.addEventListener('click', () => {
      currentRating = 0;
      _updateStars(stars, 0);
    });

    stars.forEach(s => starPicker.appendChild(s));
    starPicker.appendChild(clearStar);

    // Store getter on the element for _handleSave to read
    starPicker._getRating = () => currentRating;

    form.appendChild(field('Valutazione', false, starPicker));

    // ── Tags multi-select ────────────────────────────────────────────────
    const selectedTags = new Set(
      (book?.tags ?? []).filter(t => !t.includes('copie'))  // exclude auto-added copies tag
    );

    const tagsPicker = document.createElement('div');
    tagsPicker.className = 'tags-picker';
    tagsPicker.setAttribute('role', 'group');
    tagsPicker.setAttribute('aria-label', 'Categorie');

    const availableTags = (window._config?.tags ?? []).map(t => t.label);

    availableTags.forEach(label => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tags-picker__tag' + (selectedTags.has(label) ? ' tags-picker__tag--selected' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (selectedTags.has(label)) {
          selectedTags.delete(label);
          btn.classList.remove('tags-picker__tag--selected');
        } else {
          selectedTags.add(label);
          btn.classList.add('tags-picker__tag--selected');
        }
      });
      tagsPicker.appendChild(btn);
    });

    tagsPicker._getTags = () => [...selectedTags];

    form.appendChild(field('Categorie', false, tagsPicker));

    // ── Note ─────────────────────────────────────────────────────────────
    const noteInput = document.createElement('textarea');
    noteInput.className = 'form-textarea';
    noteInput.name = 'note';
    noteInput.value = book?.note ?? '';
    noteInput.placeholder = 'Annotazioni libere…';
    form.appendChild(field('Note', false, noteInput));

    return form;
  }

  function _updateStars(stars, rating) {
    stars.forEach((s, i) => {
      s.classList.toggle('star-picker__star--active', i < rating);
    });
  }

  // ── Save handler ──────────────────────────────────────────────────────────

  async function _handleSave() {
    const form = document.getElementById('book-form');
    if (!form) return;

    // Collect values
    const getValue = name => form.querySelector(`[name="${name}"]`)?.value.trim() ?? '';
    const starPicker = form.querySelector('.star-picker');
    const tagsPicker = form.querySelector('.tags-picker');

    const titolo = getValue('titolo');
    if (!titolo) {
      const titoloInput = form.querySelector('[name="titolo"]');
      titoloInput?.classList.add('form-input--error');
      titoloInput?.focus();
      notify.warn('Il titolo è obbligatorio.');
      return;
    }

    const bookData = {
      titolo,
      volume: getValue('volume') || undefined,
      autori: getValue('autori') || undefined,
      editore: getValue('editore') || undefined,
      data: getValue('data') || undefined,
      copie: parseInt(form.querySelector('[name="copie"]')?.value ?? '1', 10) || 1,
      rating: starPicker?._getRating() || undefined,
      tags: tagsPicker?._getTags() ?? [],
      note: getValue('note') || undefined,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvataggio…';

    try {
      let saved;

      if (panelMode === 'edit' && editingId !== null) {
        const res = await fetch(`/api/books/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookData),
        });
        if (!res.ok) throw new Error(await res.text());
        saved = await res.json();

        // Update in-place in global array
        const idx = window._books.findIndex(b => b.id === editingId);
        if (idx !== -1) window._books[idx] = saved;

        notify.success('Modifiche salvate.', { detail: saved.titolo });

      } else {
        // create or duplicate — POST
        const res = await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookData),
        });
        if (!res.ok) throw new Error(await res.text());
        saved = await res.json();

        window._books.push(saved);
        // Re-sort
        window._books.sort(_advancedSort(['titolo', 'volume']));

        notify.success(
          panelMode === 'duplicate' ? 'Testo duplicato.' : 'Testo aggiunto.',
          { detail: saved.titolo }
        );
      }

      closePanel();
      window._filterBooks();

    } catch (err) {
      notify.error('Errore durante il salvataggio.', { detail: err.message, duration: 0 });
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salva';
    }
  }

  // ── Delete with undo ──────────────────────────────────────────────────────

  async function deleteBook(bookId) {
    const book = window._books.find(b => b.id === bookId);
    if (!book) return;

    const toastId = notify.warn(
      `"${_truncate(book.titolo, 40)}" sta per essere rimosso.`,
      {
        duration: 0,
        detail: 'Conferma l\'eliminazione definitiva del testo.',
        actions: [
          {
            label: 'Annulla',
            onClick: () => {
              notify.info('Eliminazione annullata.', { detail: book.titolo });
            },
          },
          {
            label: 'Conferma',
            onClick: async () => {
              // remove from local array immediately
              const idx = window._books.findIndex(b => b.id === bookId);
              window._books.splice(idx, 1);
              window._filterBooks();
              // DELETE
              try {
                const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(await res.text());
                notify.success('Testo eliminato definitivamente.');
              } catch (err) {
                // Deletion failed — restore the book
                window._books.splice(idx, 0, book);
                window._books.sort(_advancedSort(['titolo', 'volume']));
                window._filterBooks();
                notify.error('Errore durante l\'eliminazione.', { detail: err.message, duration: 0 });
              }
            },
          },
        ],
      }
    );
  }

  // ── Public open helpers ───────────────────────────────────────────────────

  function openNew() {
    _openPanel('create', null);
  }

  function openEdit(bookId) {
    const book = window._books.find(b => b.id === bookId);
    if (!book) return;
    _openPanel('edit', book);
  }

  function openDuplicate(bookId) {
    const book = window._books.find(b => b.id === bookId);
    if (!book) return;
    _openPanel('duplicate', book);
  }

  // ── Card overlay injection ────────────────────────────────────────────────
  // Called by script.js after every renderBooks()

  function attachOverlays() {
    document.querySelectorAll('.book-card').forEach(card => {
      if (card.querySelector('.book-card__overlay')) return; // already attached

      const bookId = parseInt(card.dataset.bookId, 10);

      const overlay = document.createElement('div');
      overlay.className = 'book-card__overlay';
      overlay.setAttribute('aria-hidden', 'true');

      const editBtn = _overlayBtn('✎', 'Modifica', '', () => openEdit(bookId));
      const dupBtn = _overlayBtn('⧉', 'Duplica', 'overlay-btn--duplicate', () => openDuplicate(bookId));
      const delBtn = _overlayBtn('✕', 'Elimina', 'overlay-btn--danger', () => deleteBook(bookId));

      overlay.appendChild(editBtn);
      overlay.appendChild(dupBtn);
      overlay.appendChild(delBtn);
      card.appendChild(overlay);
    });
  }

  function _overlayBtn(icon, label, extraClass, onClick) {
    const btn = document.createElement('button');
    btn.className = 'overlay-btn' + (extraClass ? ` ${extraClass}` : '');
    btn.setAttribute('aria-label', label);

    const iconEl = document.createElement('span');
    iconEl.className = 'overlay-btn__icon';
    iconEl.textContent = icon;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;

    btn.appendChild(iconEl);
    btn.appendChild(labelEl);
    btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return btn;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function _truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function _advancedSort(props) {
    return (a, b) => {
      for (let prop of props) {
        let desc = false;
        if (prop.startsWith('-')) { desc = true; prop = prop.slice(1); }
        const cmp = String(a[prop] ?? '').localeCompare(String(b[prop] ?? ''), undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return desc ? -cmp : cmp;
      }
      return 0;
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return { init, openNew, openEdit, openDuplicate, deleteBook, attachOverlays };

})();