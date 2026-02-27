/**
 * sync.js — Sync status indicator & push UI
 *
 * Renders a small status widget inside .header__nav that shows:
 *   · "In sync"  when clean and ahead === 0
 *   · "N unsaved changes"  when dirty (uncommitted edits)
 *   · "N ahead"  when commits exist but not yet pushed
 *   · A "Push" button whenever there is something to push
 *
 * Uses notify.js for feedback and polls /api/sync/status periodically.
 *
 * Public API  (window.sync):
 *   sync.refresh()   — force an immediate status check
 *   sync.init()      — called once by script.js after the page is ready
 */

const sync = (() => {

  // ── Config ─────────────────────────────────────────────────────────────────

  const POLL_INTERVAL_MS   = 30_000;   // background poll every 30 s
  const REFRESH_AFTER_EDIT = 2_000;    // re-check 2 s after a book mutation

  // ── State ──────────────────────────────────────────────────────────────────

  let _status       = null;    // last known SyncStatus from the API
  let _pushing      = false;
  let _pollTimer    = null;
  let _debounceTimer = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────

  let _widget       = null;   // outer wrapper injected into .header__nav
  let _indicator    = null;   // <span> showing the status text / dot
  let _pushBtn      = null;   // <button> "Push"
  let _spinner      = null;   // SVG spinner shown while pushing

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  function init() {
    _buildWidget();
    refresh();
    _pollTimer = setInterval(refresh, POLL_INTERVAL_MS);

    // Re-check shortly after any book mutation so the dirty indicator updates
    store.onChange(() => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(refresh, REFRESH_AFTER_EDIT);
    });
  }

  // ── Widget construction ────────────────────────────────────────────────────

  function _buildWidget() {
    const nav = document.querySelector('.header__nav');
    if (!nav) return;

    // Remove placeholder text
    nav.textContent = '';

    _widget = document.createElement('div');
    _widget.className = 'sync-widget';

    _indicator = document.createElement('div');
    _indicator.className = 'sync-indicator sync-indicator--loading';
    _indicator.setAttribute('aria-live', 'polite');
    _indicator.setAttribute('aria-label', 'Stato sincronizzazione');

    const dot = document.createElement('span');
    dot.className = 'sync-dot';

    const label = document.createElement('span');
    label.className = 'sync-label';
    label.textContent = 'Controllo…';

    _indicator.appendChild(dot);
    _indicator.appendChild(label);

    _pushBtn = document.createElement('button');
    _pushBtn.className = 'sync-push-btn';
    _pushBtn.setAttribute('aria-label', 'Sincronizza con GitHub Pages');
    _pushBtn.style.display = 'none';

    _spinner = _buildSpinner();
    const btnLabel = document.createElement('span');
    btnLabel.className = 'sync-push-label';
    btnLabel.textContent = 'Pubblica';

    _pushBtn.appendChild(_spinner);
    _pushBtn.appendChild(btnLabel);
    _pushBtn.addEventListener('click', _handlePush);

    _widget.appendChild(_indicator);
    _widget.appendChild(_pushBtn);
    nav.appendChild(_widget);
  }

  function _buildSpinner() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sync-spinner');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '8');
    circle.setAttribute('cy', '8');
    circle.setAttribute('r', '6');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('stroke-dasharray', '28');
    circle.setAttribute('stroke-dashoffset', '10');
    svg.appendChild(circle);
    return svg;
  }

  // ── Status polling ─────────────────────────────────────────────────────────

  async function refresh() {
    try {
      const res = await fetch('/api/sync/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _status = await res.json();
      _render();
    } catch (err) {
      _renderError();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function _render() {
    if (!_indicator || !_pushBtn) return;
    const label = _indicator.querySelector('.sync-label');

    if (_pushing) {
      _indicator.className = 'sync-indicator sync-indicator--pushing';
      label.textContent = 'Invio…';
      _pushBtn.style.display = 'none';
      return;
    }

    const { dirty, ahead } = _status;
    const hasPending = dirty || ahead > 0;

    if (!hasPending) {
      _indicator.className = 'sync-indicator sync-indicator--clean';
      label.textContent = 'Aggiornato';
      _pushBtn.style.display = 'none';
    } else {
      _indicator.className = 'sync-indicator sync-indicator--dirty';
      const parts = [];
      if (dirty)   parts.push(`modifiche non salvate`);
      // if (dirty)   parts.push(`${dirty ? '●' : ''} modifiche non salvate`);
      if (ahead > 0) parts.push(`${ahead} da inviare`);
      label.textContent = parts.join(' · ');
      _pushBtn.style.display = '';
    }
  }

  function _renderError() {
    if (!_indicator) return;
    const label = _indicator.querySelector('.sync-label');
    _indicator.className = 'sync-indicator sync-indicator--error';
    label.textContent = 'Stato sconosciuto';
    if (_pushBtn) _pushBtn.style.display = 'none';
  }

  // ── Push handler ───────────────────────────────────────────────────────────

  async function _handlePush() {
    if (_pushing) return;
    _pushing = true;
    _pushBtn.disabled = true;
    _pushBtn.classList.add('sync-push-btn--loading');
    _render();

    try {
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Update catalogue' }),
      });

      const result = await res.json();

      if (result.success) {
        notify.success('Catalogo pubblicato su GitHub Pages.', {
          detail: result.sha ? `Commit: ${result.sha}` : undefined,
        });
        await refresh();
      } else {
        notify.error('Pubblicazione non riuscita.', {
          detail: result.error,
          duration: 0,
        });
        _render();
      }
    } catch (err) {
      notify.error('Errore di rete durante il push.', {
        detail: err.message,
        duration: 0,
      });
      _render();
    } finally {
      _pushing = false;
      _pushBtn.disabled = false;
      _pushBtn.classList.remove('sync-push-btn--loading');
      _render();
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return { init, refresh };

})();