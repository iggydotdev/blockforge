import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Read trimmed text content from a cell, ignoring empty wrappers.
 * @param {Element|undefined} cell field container
 * @returns {string}
 */
function readText(cell) {
  if (!cell) return '';
  return (cell.textContent || '').trim();
}

/**
 * Read each child paragraph (or direct child) of a grouped cell as a trimmed string.
 * Handles both shapes produced by aem.js `wrapTextNodes`: the original cell with
 * direct `<p>` children, or a cell whose content was wrapped one level deeper.
 * @param {Element|undefined} cell block cell
 * @returns {string[]}
 */
function readGroupedRow(cell) {
  if (!cell) return [];
  // Prefer direct paragraph children; fall back to the first descendant container
  // (covers cases where an extra wrapper exists in legacy/draft markup).
  let parts = [...cell.children].filter((c) => c.tagName === 'P');
  if (parts.length === 0) {
    const inner = cell.querySelector(':scope > div');
    if (inner) {
      parts = [...inner.children].filter((c) => c.tagName === 'P');
    }
  }
  if (parts.length === 0) {
    const text = readText(cell);
    return text ? [text] : [];
  }
  return parts.map((p) => (p.textContent || '').trim());
}

/**
 * Normalise the icon position value to either 'top' or 'left'.
 * @param {string} value raw authored value
 * @returns {'top'|'left'}
 */
function normalisePosition(value) {
  return value && value.toLowerCase() === 'left' ? 'left' : 'top';
}

/**
 * Normalise the link target value to either '_self' or '_blank'.
 * @param {string} value raw authored value
 * @returns {'_self'|'_blank'}
 */
function normaliseTarget(value) {
  return value && value.toLowerCase() === '_self' ? '_self' : '_blank';
}

/**
 * Decorate the quick-links block.
 * Expected row order per item (one row per grouped authoring cell):
 *   0 icon cell    — <picture> (icon) with collapsed iconAlt as img alt attribute
 *   1 display cell — paragraphs: [display_iconPosition, display_label, display_description]
 *   2 link cell    — <a> (link_link) + paragraph: [link_linkTarget]
 * @param {Element} block the block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'quick-links-list';

  [...block.children].forEach((item, index) => {
    const rows = [...item.children];
    const iconRow = rows[0];
    const displayValues = readGroupedRow(rows[1]);
    const linkRow = rows[2];

    const position = normalisePosition(displayValues[0]);
    const label = displayValues[1] || '';
    const description = displayValues[2] || '';

    const linkAnchor = linkRow ? linkRow.querySelector('a') : null;
    // Iterate grouped cell children by position so empty paragraphs preserve field order:
    //   child 0 -> link_link (contains <a>), child 1 -> link_linkTarget
    // Note: legacy authored content may include a stray middle paragraph (link_linkText); it is
    // ignored — the target is read from the LAST child to remain backwards compatible.
    let linkChildren = linkRow ? [...linkRow.children].filter((c) => c.tagName === 'P') : [];
    if (linkChildren.length === 0 && linkRow) {
      const linkInner = linkRow.querySelector(':scope > div');
      if (linkInner) linkChildren = [...linkInner.children].filter((c) => c.tagName === 'P');
    }
    const targetRaw = linkChildren.length
      ? (linkChildren[linkChildren.length - 1].textContent || '').trim()
      : '';
    const target = normaliseTarget(targetRaw);
    const hrefRaw = linkAnchor ? (linkAnchor.getAttribute('href') || '') : '';
    const href = hrefRaw.trim();

    const li = document.createElement('li');
    li.className = `quick-link quick-link-icon-${position}`;
    moveInstrumentation(item, li);

    const anchor = document.createElement('a');
    anchor.className = 'quick-link-anchor';
    anchor.href = href || '#';
    if (!href) anchor.setAttribute('data-broken-link', 'true');
    anchor.target = target;
    if (target === '_blank') anchor.rel = 'noopener noreferrer';

    if (label) anchor.setAttribute('aria-label', label);

    const descId = description ? `ql-desc-${index}` : '';
    if (descId) anchor.setAttribute('aria-describedby', descId);

    const iconWrap = document.createElement('div');
    iconWrap.className = 'quick-link-icon';
    const sourceImg = iconRow ? iconRow.querySelector('img') : null;
    if (sourceImg) {
      const altFromImg = sourceImg.getAttribute('alt') || '';
      const optimized = createOptimizedPicture(
        sourceImg.getAttribute('src'),
        altFromImg,
        false,
        [{ width: '96' }],
      );
      const optimizedImg = optimized.querySelector('img');
      if (optimizedImg) {
        optimizedImg.setAttribute('width', '48');
        optimizedImg.setAttribute('height', '48');
        if (altFromImg) optimizedImg.setAttribute('alt', altFromImg);
        moveInstrumentation(sourceImg, optimizedImg);
      }
      iconWrap.append(optimized);
    } else if (iconRow) {
      const existingPic = iconRow.querySelector('picture');
      if (existingPic) iconWrap.append(existingPic);
    }

    const body = document.createElement('div');
    body.className = 'quick-link-body';

    const head = document.createElement('span');
    head.className = 'quick-link-head';

    const labelEl = document.createElement('span');
    labelEl.className = 'quick-link-label';
    labelEl.textContent = label;

    const arrow = document.createElement('span');
    arrow.className = 'quick-link-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '\u203A';

    head.append(labelEl, arrow);
    body.append(head);

    if (description) {
      const desc = document.createElement('p');
      desc.className = 'quick-link-description';
      desc.id = descId;
      desc.textContent = description;
      body.append(desc);
    }

    anchor.append(iconWrap, body);
    li.append(anchor);
    ul.append(li);
  });

  block.textContent = '';
  block.append(ul);
}
