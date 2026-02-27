/**
 * tags.js — Tag catalogue manager
 *
 * Provides a slide-in panel for managing the tag taxonomy:
 *   · View all tags as an editable list
 *   · Add a new tag (label + optional description)
 *   · Rename a tag inline (cascades to all books via PUT /api/tags/:id)
 *   · Delete a tag with confirmation showing affected-book count
 *     (cascades via DELETE /api/tags/:id, then reloads books from server)
 *
 * Entry points:
 *   · "Gestisci tag" link next to the tag filters in the main page
 *   · "+ nuovo" chip at the end of the tags picker in the book editor panel
 *
 * Depends on:
 *   notify.js   (must be loaded first)
 *   store.js    (must be loaded first)
 *
 * Public API (window.tags):
 *   tags.init()    — called once by script.js after loadData()
 *   tags.open()    — open the panel (used by editor.js "+ nuovo" chip)
 */

const tags = (() => {

    // ── DOM refs ───────────────────────────────────────────────────────────────

    let backdrop, panel, panelBody;

    // ── Bootstrap ──────────────────────────────────────────────────────────────

    function init() {
        _buildPanel();
    }

    // ── Panel construction ─────────────────────────────────────────────────────

    function _buildPanel() {
        // Backdrop
        backdrop = document.createElement('div');
        backdrop.className = 'panel-backdrop';
        backdrop.addEventListener('click', close);
        document.body.appendChild(backdrop);

        // Panel shell — same structure as editor panel
        panel = document.createElement('div');
        panel.className = 'editor-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'tags-panel-title');

        // Header
        const header = document.createElement('div');
        header.className = 'panel-header';

        const titleBlock = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'panel-title';
        title.id = 'tags-panel-title';
        title.textContent = 'Gestione categorie';
        const subtitle = document.createElement('div');
        subtitle.className = 'panel-subtitle';
        subtitle.textContent = 'Aggiungi, rinomina o rimuovi le categorie del catalogo';
        titleBlock.appendChild(title);
        titleBlock.appendChild(subtitle);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'panel-close';
        closeBtn.setAttribute('aria-label', 'Chiudi pannello');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', close);

        header.appendChild(titleBlock);
        header.appendChild(closeBtn);

        // Body
        panelBody = document.createElement('div');
        panelBody.className = 'panel-body';

        // Footer — single close button
        const footer = document.createElement('div');
        footer.className = 'panel-footer';
        const footerClose = document.createElement('button');
        footerClose.className = 'btn-panel-cancel';
        footerClose.style.flex = '1';
        footerClose.textContent = 'Chiudi';
        footerClose.addEventListener('click', close);
        footer.appendChild(footerClose);

        panel.appendChild(header);
        panel.appendChild(panelBody);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        // Escape key
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && panel.classList.contains('editor-panel--open')) {
                close();
            }
        });
    }

    // ── Open / close ───────────────────────────────────────────────────────────

    function open() {
        _renderBody();
        backdrop.classList.add('panel-backdrop--visible');
        panel.classList.add('editor-panel--open');
    }

    function close() {
        backdrop.classList.remove('panel-backdrop--visible');
        panel.classList.remove('editor-panel--open');
    }

    // ── Body rendering ─────────────────────────────────────────────────────────

    function _renderBody() {
        panelBody.innerHTML = '';

        const currentTags = store.config?.tags ?? [];

        // ── Tag list ──────────────────────────────────────────────────────────────
        if (currentTags.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'tag-list-empty';
            empty.textContent = 'Nessuna categoria definita.';
            panelBody.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.className = 'tag-list';
            list.id = 'tag-list';
            currentTags.forEach(tag => list.appendChild(_buildTagRow(tag)));
            panelBody.appendChild(list);
        }

        // ── Add-new form ──────────────────────────────────────────────────────────
        panelBody.appendChild(_buildAddForm());
    }

    // ── Tag row (view mode) ────────────────────────────────────────────────────

    function _buildTagRow(tag) {
        const row = document.createElement('div');
        row.className = 'tag-row';
        row.dataset.tagId = tag.id;

        // Text block
        const labelWrap = document.createElement('div');
        labelWrap.className = 'tag-row__label';
        const labelText = document.createElement('div');
        labelText.textContent = tag.label;
        labelWrap.appendChild(labelText);
        if (tag.description) {
            const desc = document.createElement('div');
            desc.className = 'tag-row__desc';
            desc.textContent = tag.description;
            labelWrap.appendChild(desc);
        }

        // Actions (shown on hover via CSS)
        const actions = document.createElement('div');
        actions.className = 'tag-row__actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'tag-row__btn';
        editBtn.setAttribute('aria-label', `Modifica categoria ${tag.label}`);
        editBtn.textContent = '✎';
        editBtn.addEventListener('click', () => _enterEditMode(row, tag));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tag-row__btn tag-row__btn--danger';
        deleteBtn.setAttribute('aria-label', `Elimina categoria ${tag.label}`);
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', () => _confirmDelete(tag));

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        row.appendChild(labelWrap);
        row.appendChild(actions);
        return row;
    }

    // ── Tag row (edit mode) ────────────────────────────────────────────────────

    function _enterEditMode(row, tag) {
        // Collapse any other row currently in edit mode
        document.querySelectorAll('.tag-row--editing').forEach(r => {
            if (r !== row) _exitEditMode(r);
        });

        row.innerHTML = '';
        row.classList.add('tag-row--editing');

        const fields = document.createElement('div');
        fields.className = 'tag-row__edit-fields';

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'tag-row__edit-input';
        labelInput.value = tag.label;
        labelInput.placeholder = 'Nome categoria';
        labelInput.setAttribute('aria-label', 'Nome categoria');

        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.className = 'tag-row__edit-input tag-row__edit-input--desc';
        descInput.value = tag.description ?? '';
        descInput.placeholder = 'Descrizione (opzionale)';
        descInput.setAttribute('aria-label', 'Descrizione categoria');

        fields.appendChild(labelInput);
        fields.appendChild(descInput);

        const btns = document.createElement('div');
        btns.className = 'tag-row__edit-btns';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-tag-save';
        saveBtn.textContent = 'Salva';
        saveBtn.addEventListener('click', () => _saveEdit(row, tag, labelInput, descInput, saveBtn));

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-tag-cancel';
        cancelBtn.textContent = 'Annulla';
        cancelBtn.addEventListener('click', () => _exitEditMode(row));

        btns.appendChild(saveBtn);
        btns.appendChild(cancelBtn);

        row.appendChild(fields);
        row.appendChild(btns);

        requestAnimationFrame(() => labelInput.focus());

        // Enter key saves
        labelInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
        });
        descInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
        });
    }

    function _exitEditMode(row) {
        const tagId = row.dataset.tagId;
        const tag = (store.config?.tags ?? []).find(t => t.id === tagId);
        if (!tag) {
            // Tag was just deleted — remove the row
            row.remove();
            return;
        }
        row.classList.remove('tag-row--editing');
        row.innerHTML = '';
        // Re-render as a view-mode row in place
        const fresh = _buildTagRow(tag);
        row.replaceWith(fresh);
    }

    async function _saveEdit(row, tag, labelInput, descInput, saveBtn) {
        const newLabel = labelInput.value.trim();
        if (!newLabel) {
            labelInput.classList.add('form-input--error');
            labelInput.focus();
            notify.warn('Il nome della categoria è obbligatorio.');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvataggio…';

        try {
            const res = await fetch(`/api/tags/${encodeURIComponent(tag.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: newLabel, description: descInput.value.trim() || undefined }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { tag: updated, affectedBooks } = await res.json();

            // Update store config
            const cfg = store.config;
            const idx = cfg.tags.findIndex(t => t.id === tag.id);
            if (idx !== -1) cfg.tags[idx] = updated;
            store.setConfig({ ...cfg });

            // If the label changed we need to refresh books too
            if (tag.label !== newLabel && affectedBooks > 0) {
                const booksRes = await fetch('/api/books');
                if (booksRes.ok) store.setBooks(await booksRes.json());
                notify.success(`Categoria rinominata.`, {
                    detail: `${affectedBooks} ${affectedBooks === 1 ? 'testo aggiornato' : 'testi aggiornati'}.`,
                });
            } else {
                notify.success('Categoria aggiornata.');
            }

            // Re-render the panel body to reflect changes
            _renderBody();

        } catch (err) {
            notify.error('Errore durante il salvataggio.', { detail: err.message, duration: 0 });
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salva';
        }
    }

    // ── Delete with confirmation ───────────────────────────────────────────────

    function _confirmDelete(tag) {
        // Count how many books carry this tag
        const count = (store.books ?? []).filter(b => b.tags.includes(tag.label)).length;
        const countStr = count > 0
            ? `Rimuoverla interesserà <span class="tag-affected-count">${count} ${count === 1 ? 'testo' : 'testi'}</span>.`
            : 'Nessun testo la utilizza.';

        const toastId = notify.warn(`Eliminare la categoria «${tag.label}»?`, {
            duration: 0,
            detail: `${count > 0 ? `${count} ${count === 1 ? 'testo' : 'testi'} ${count === 1 ? 'la utilizza' : 'la utilizzano'} e verr${count === 1 ? 'à' : 'anno'} aggiornato/i.` : 'Nessun testo la utilizza.'}`,
            actions: [
                { label: 'Annulla', onClick: () => { } },
                {
                    label: 'Elimina',
                    onClick: () => _doDelete(tag),
                },
            ],
        });
    }

    async function _doDelete(tag) {
        try {
            const res = await fetch(`/api/tags/${encodeURIComponent(tag.id)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            const { affectedBooks } = await res.json();

            // Update store config
            const cfg = store.config;
            cfg.tags = cfg.tags.filter(t => t.id !== tag.id);
            store.setConfig({ ...cfg });

            // Refresh books if any were affected
            if (affectedBooks > 0) {
                const booksRes = await fetch('/api/books');
                if (booksRes.ok) store.setBooks(await booksRes.json());
            }

            notify.success(`Categoria «${tag.label}» eliminata.`, {
                detail: affectedBooks > 0
                    ? `${affectedBooks} ${affectedBooks === 1 ? 'testo aggiornato' : 'testi aggiornati'}.`
                    : undefined,
            });

            _renderBody();

        } catch (err) {
            notify.error('Errore durante l\'eliminazione.', { detail: err.message, duration: 0 });
        }
    }

    // ── Add-new form ───────────────────────────────────────────────────────────

    function _buildAddForm() {
        const form = document.createElement('div');
        form.className = 'tag-add-form';

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'tag-add-form__input';
        labelInput.placeholder = 'Nuova categoria…';
        labelInput.setAttribute('aria-label', 'Nome nuova categoria');

        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.className = 'tag-add-form__input';
        descInput.placeholder = 'Descrizione (opzionale)';
        descInput.setAttribute('aria-label', 'Descrizione nuova categoria');

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-tag-save';
        addBtn.textContent = '＋ Aggiungi';

        const doAdd = async () => {
            const label = labelInput.value.trim();
            if (!label) {
                labelInput.classList.add('tag-add-form__input--error');
                labelInput.focus();
                notify.warn('Inserisci il nome della categoria.');
                return;
            }

            // Check for duplicate label (client-side fast-path)
            const existing = (store.config?.tags ?? []).find(
                t => t.label.toLowerCase() === label.toLowerCase()
            );
            if (existing) {
                labelInput.classList.add('tag-add-form__input--error');
                labelInput.focus();
                notify.warn(`La categoria «${label}» esiste già.`);
                return;
            }

            addBtn.disabled = true;
            addBtn.textContent = 'Aggiunta…';

            try {
                const res = await fetch('/api/tags', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label, description: descInput.value.trim() || undefined }),
                });
                if (!res.ok) throw new Error(await res.text());
                const newTag = await res.json();

                // Update store config
                const cfg = store.config;
                cfg.tags = [...cfg.tags, newTag];
                store.setConfig({ ...cfg });

                notify.success(`Categoria «${newTag.label}» aggiunta.`);
                labelInput.value = '';
                descInput.value = '';
                labelInput.classList.remove('tag-add-form__input--error');

                _renderBody();

                // Re-focus the label input for fast multi-add
                requestAnimationFrame(() => {
                    panelBody.querySelector('.tag-add-form__input')?.focus();
                });

            } catch (err) {
                notify.error('Errore durante l\'aggiunta.', { detail: err.message, duration: 0 });
            } finally {
                addBtn.disabled = false;
                addBtn.textContent = '＋ Aggiungi';
            }
        };

        addBtn.addEventListener('click', doAdd);
        labelInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
        });
        descInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
        });
        labelInput.addEventListener('input', () => {
            labelInput.classList.remove('tag-add-form__input--error');
        });

        const mainRow = document.createElement('div');
        mainRow.className = 'tag-add-form__row';
        mainRow.appendChild(labelInput);
        mainRow.appendChild(addBtn);

        form.appendChild(mainRow);
        form.appendChild(descInput);

        return form;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    return { init, open, close };

})();