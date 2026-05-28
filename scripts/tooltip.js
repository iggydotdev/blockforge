/**
 * Tooltip decoration.
 *
 * Author workflow: in any rich-text field, insert a link with
 *   - URL:   #tooltip
 *   - Title: the tooltip text
 *
 *   <a href="#tooltip" title="Short explanation">term</a>
 *
 * This pass rewrites every such anchor into a self-contained tooltip widget
 * with hover, focus and tap support — no fetch, no extra block.
 *
 * Sentinel `#tooltip` is reserved so we can layer a fragment-based mode on
 * top later (e.g. `href="/tooltips/foo"`) without breaking this one.
 */

const TOOLTIP_HREF = '#tooltip';
let idCounter = 0;
let globalListenersAttached = false;

/**
 * Attach document-level listeners exactly once: outside-tap closes any open
 * touch tooltip; Escape closes a focused tooltip.
 */
function ensureGlobalListeners() {
  if (globalListenersAttached) return;
  globalListenersAttached = true;

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.tooltip.is-open').forEach((tip) => {
      if (!tip.contains(e.target)) tip.classList.remove('is-open');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const active = document.activeElement;
    if (active && active.classList.contains('tooltip')) {
      active.classList.remove('is-open');
      active.blur();
    }
  });
}

/**
 * Replace a single trigger anchor with the tooltip widget.
 * @param {HTMLAnchorElement} anchor
 */
function buildTooltip(anchor) {
  const text = (anchor.getAttribute('title') || '').trim();
  if (!text) {
    // Nothing to show — strip the sentinel so we don't leave a dead link.
    anchor.removeAttribute('href');
    anchor.removeAttribute('title');
    return;
  }

  idCounter += 1;
  const id = `tooltip-${idCounter}`;

  const wrapper = document.createElement('span');
  wrapper.className = 'tooltip';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('aria-describedby', id);

  // Move the original term content into the wrapper.
  while (anchor.firstChild) wrapper.appendChild(anchor.firstChild);

  const bubble = document.createElement('span');
  bubble.className = 'tooltip-content';
  bubble.id = id;
  bubble.setAttribute('role', 'tooltip');
  bubble.textContent = text;
  wrapper.appendChild(bubble);

  // Touch: tap toggles open. Hover/focus are handled by CSS, and keyboard
  // activation lands via focus — so only synthesise toggling for real
  // pointer clicks (detail > 0).
  wrapper.addEventListener('click', (e) => {
    if (e.detail === 0) return;
    e.preventDefault();
    wrapper.classList.toggle('is-open');
  });

  anchor.replaceWith(wrapper);
}

/**
 * Find and decorate every inline-tooltip trigger inside `root`.
 * @param {ParentNode} root
 */
export default function decorateTooltips(root) {
  if (!root) return;
  const triggers = root.querySelectorAll(`a[href="${TOOLTIP_HREF}"]`);
  if (!triggers.length) return;
  triggers.forEach(buildTooltip);
  ensureGlobalListeners();
}
