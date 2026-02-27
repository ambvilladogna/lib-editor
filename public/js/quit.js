/**
 * quit.js — Server shutdown button
 *
 * Appends a small "Esci" button to .header__nav (after the sync widget).
 * On click, asks for confirmation via a notify.js toast, then POSTs to
 * /api/quit and replaces the page with a "safe to close" screen.
 *
 * Because window.close() is blocked by browsers on tabs the user navigated
 * to directly, we can only show a message — we cannot close the tab for them.
 *
 * Depends on:
 *   notify.js  (must be loaded first)
 *
 * Public API (window.quit):
 *   quit.init()   — called once by script.js after the page is ready
 */

const quit = (() => {

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  function init() {
    _buildButton();
  }

  // ── DOM ────────────────────────────────────────────────────────────────────

  function _buildButton() {
    const nav = document.querySelector('.header__nav');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.className = 'quit-btn';
    btn.setAttribute('aria-label', 'Chiudi il server e termina la sessione');
    btn.innerHTML =
      '<span class="quit-btn__icon" aria-hidden="true">⏻</span>' +
      '<span class="quit-btn__label">Esci</span>';
    btn.addEventListener('click', _handleClick);
    nav.appendChild(btn);
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  function _handleClick() {
    notify.warn('Terminare il server?', {
      duration: 0,
      detail: 'Il server si spegnerà e l\'editor non sarà più raggiungibile.',
      actions: [
        {
          label: 'Annulla',
          onClick: () => { /* notify auto-dismisses on action click */ },
        },
        {
          label: 'Termina',
          onClick: _doQuit,
        },
      ],
    });
  }

  async function _doQuit() {
    try {
      await fetch('/api/quit', { method: 'POST' });
    } catch {
      // A network error here is expected — the server closed the connection
      // as it was shutting down. We treat it the same as a clean response.
    }
    _showGoodbye();
  }

  // ── Goodbye screen ─────────────────────────────────────────────────────────

  function _showGoodbye() {
    document.body.innerHTML = `
      <div class="quit-goodbye">
        <div class="quit-goodbye__card">
          <div class="quit-goodbye__icon">⏻</div>
          <h1 class="quit-goodbye__title">Server spento</h1>
          <p class="quit-goodbye__msg">
            Il server è stato arrestato correttamente.<br>
            Puoi chiudere questa scheda.
          </p>
        </div>
      </div>
    `;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return { init };

})();