/**
 * notify.js — Biblioteca Micologica notification service
 *
 * A lightweight, self-contained toast system that fits the library's
 * archival aesthetic. No dependencies.
 *
 * Usage:
 *   notify.success("Modifiche salvate.");
 *   notify.error("Errore durante il push.", { duration: 0 });  // duration:0 = sticky
 *   notify.info("Nessuna modifica da sincronizzare.");
 *   notify.warn("Repository non aggiornato.");
 *   notify.dismiss(id);   // dismiss a specific toast by id
 *   notify.clear();       // dismiss all visible toasts
 *
 * Each call returns the toast's string id.
 *
 * Options (second argument, all optional):
 *   duration  {number}   ms before auto-dismiss. 0 = sticky. Default: 4500
 *   detail    {string}   secondary line of smaller text below the main message
 *   actions   {Array}    [{label, onClick}] action buttons rendered inside the toast
 */

const notify = (() => {

  // ── Constants ────────────────────────────────────────────────────────────────

  const DEFAULTS = { duration: 4500 };

  const ICONS = {
    success: "✓",
    error:   "✕",
    warn:    "⚠",
    info:    "ℹ",
  };

  // ── Container (created once, lazily) ─────────────────────────────────────────

  let container = null;

  function getContainer() {
    if (container) return container;
    container = document.createElement("div");
    container.className = "notify-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-label", "Notifiche");
    document.body.appendChild(container);
    return container;
  }

  // ── Core: create a single toast ───────────────────────────────────────────────

  let counter = 0;

  function show(type, message, opts = {}) {
    const { duration = DEFAULTS.duration, detail, actions } = opts;
    const id = `notify-${++counter}`;
    const c = getContainer();

    // Outer wrapper handles slide-in / slide-out animation
    const wrapper = document.createElement("div");
    wrapper.className = "notify-wrapper";
    wrapper.id = id;
    wrapper.setAttribute("role", type === "error" ? "alert" : "status");

    // Toast card
    const toast = document.createElement("div");
    toast.className = `notify-toast notify-toast--${type}`;

    // Icon stamp
    const icon = document.createElement("span");
    icon.className = "notify-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = ICONS[type] ?? "•";

    // Text block
    const textBlock = document.createElement("div");
    textBlock.className = "notify-text";

    const msgEl = document.createElement("span");
    msgEl.className = "notify-message";
    msgEl.textContent = message;
    textBlock.appendChild(msgEl);

    if (detail) {
      const detailEl = document.createElement("span");
      detailEl.className = "notify-detail";
      detailEl.textContent = detail;
      textBlock.appendChild(detailEl);
    }

    // Optional action buttons
    if (actions && actions.length > 0) {
      const actionsEl = document.createElement("div");
      actionsEl.className = "notify-actions";
      actions.forEach(({ label, onClick }) => {
        const btn = document.createElement("button");
        btn.className = "notify-action-btn";
        btn.textContent = label;
        btn.addEventListener("click", () => { onClick?.(); dismiss(id); });
        actionsEl.appendChild(btn);
      });
      textBlock.appendChild(actionsEl);
    }

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "notify-close";
    closeBtn.setAttribute("aria-label", "Chiudi notifica");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => dismiss(id));

    toast.appendChild(icon);
    toast.appendChild(textBlock);
    toast.appendChild(closeBtn);
    wrapper.appendChild(toast);
    c.appendChild(wrapper);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => requestAnimationFrame(() =>
      wrapper.classList.add("notify-wrapper--visible")
    ));

    // Auto-dismiss
    if (duration > 0) setTimeout(() => dismiss(id), duration);

    return id;
  }

  // ── Dismiss ───────────────────────────────────────────────────────────────────

  function dismiss(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    wrapper.classList.remove("notify-wrapper--visible");
    wrapper.classList.add("notify-wrapper--leaving");
    // Remove after transition; safety timeout for reduced-motion envs
    wrapper.addEventListener("transitionend", () => wrapper.remove(), { once: true });
    setTimeout(() => wrapper.remove(), 600);
  }

  function clear() {
    [...getContainer().children].forEach(w => dismiss(w.id));
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  return {
    success: (msg, opts) => show("success", msg, opts),
    error:   (msg, opts) => show("error",   msg, opts),
    warn:    (msg, opts) => show("warn",    msg, opts),
    info:    (msg, opts) => show("info",    msg, opts),
    dismiss,
    clear,
  };
})();