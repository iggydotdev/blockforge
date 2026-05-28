import { decorateIcons } from '../../scripts/aem.js';
import { inlineSVGs, moveInstrumentation } from '../../scripts/scripts.js';

const LIST_TYPES = new Set(['ordered', 'unordered']);
const ORDERED_STYLES = new Set([
  'decimal',
  'upper-roman',
  'lower-roman',
  'upper-alpha',
  'lower-alpha',
]);
const ICON_STYLES = new Set([
  'checkmark',
  'right-arrow',
  'star',
  'circle',
  'square',
]);
const INDENT_TOKENS = new Set(['0', '1', '2']);
const MAX_DEPTH = 2;
const ROMAN_VALUES = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
};

/**
 * Convert a Roman numeral string (already uppercased) to a positive integer.
 * Returns null if the input is not a valid Roman numeral.
 * @param {string} s
 * @returns {number|null}
 */
function romanToInt(s) {
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const cur = ROMAN_VALUES[s[i]];
    const next = ROMAN_VALUES[s[i + 1]];
    if (next && cur < next) total -= cur;
    else total += cur;
  }
  return total > 0 ? total : null;
}

/**
 * Parse an author-supplied start value into a positive integer.
 * Accepts decimal numbers, single letters (A=1..Z=26), or Roman numerals.
 * Returns null when the input is empty or unparseable.
 * @param {string} input
 * @returns {number|null}
 */
function parseStart(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n > 0 ? n : null;
  }
  if (/^[a-zA-Z]$/.test(s)) {
    return s.toUpperCase().charCodeAt(0) - 64; // A=1..Z=26
  }
  if (/^[ivxlcdmIVXLCDM]+$/.test(s)) {
    return romanToInt(s.toUpperCase());
  }
  return null;
}

/**
 * Read container settings from the rows that precede the list-item children.
 * Prefers Universal Editor data-aue-prop attributes; falls back to matching
 * cell text against known token sets for preview/drafts HTML.
 * @param {Element[]} settingRows
 * @returns {{ variant: string, listStyle: string, startValue: string }}
 */
function parseContainerSettings(settingRows) {
  const settings = { variant: 'unordered', listStyle: '', startValue: '' };
  settingRows.forEach((row) => {
    row.querySelectorAll(':scope > div').forEach((cell) => {
      const prop = cell.getAttribute('data-aue-prop');
      const raw = cell.textContent.trim();
      if (prop === 'variant') {
        if (LIST_TYPES.has(raw)) settings.variant = raw;
      } else if (prop === 'listStyleOrdered' || prop === 'listStyleUnordered') {
        if (raw) settings.listStyle = raw;
      } else if (prop === 'startValue') {
        settings.startValue = raw;
      } else if (!prop) {
        // Legacy/preview HTML: fall back to token matching.
        if (!raw) return;
        const token = raw.toLowerCase();
        if (LIST_TYPES.has(token)) settings.variant = token;
        else if (ORDERED_STYLES.has(token) || ICON_STYLES.has(token)) settings.listStyle = token;
        else if (!settings.startValue) settings.startValue = raw;
      }
    });
    row.remove();
  });
  return settings;
}

/**
 * Resolve the effective cell element for an item child. In Universal Editor
 * rendering the item's direct children ARE the field cells. In the legacy
 * preview/drafts shape each field is wrapped in an extra div, so the real
 * cell is one level deeper.
 * @param {Element} child
 * @returns {Element}
 */
function resolveCell(child) {
  if (
    child.children.length === 1
    && child.firstElementChild.tagName === 'DIV'
    && !child.hasAttribute('data-aue-prop')
    && !child.hasAttribute('data-aue-component')
  ) {
    const onlyText = [...child.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join('');
    if (!onlyText) return child.firstElementChild;
  }
  return child;
}

/**
 * Find the nearest element matching `selector` within `root` that does NOT
 * live inside a nested list-item. UE may wrap individual field cells in
 * extra divs so we cannot assume the field is a direct child.
 * @param {Element} root
 * @param {string} selector
 * @returns {Element|null}
 */
function findFieldEl(root, selector) {
  const matches = root.querySelectorAll(selector);
  for (let i = 0; i < matches.length; i += 1) {
    const el = matches[i];
    if (el.closest('[data-aue-component="list-item"]') === root) return el;
  }
  // Fallback: first match regardless (root might not have the marker yet).
  return matches[0] || null;
}

/**
 * Parse a single list-item element into its settings + content cell.
 * Reads field cells by `data-aue-prop` ANYWHERE inside the item (UE may wrap
 * individual fields in extra divs). Falls back to positional token matching
 * when no UE markers are present (drafts/preview HTML).
 * @param {Element} itemEl
 */
function parseItem(itemEl) {
  // TEMP DEBUG — remove after diagnosis.
  // eslint-disable-next-line no-console
  console.log('[list-items DEBUG] itemEl.outerHTML:', itemEl.outerHTML);

  let contentRow = null;
  let indent = 0;
  let nestedVariant = '';
  let nestedStyle = '';
  let startValue = '';

  // Universal Editor path: locate each field by its data-aue-prop, regardless
  // of nesting depth inside the item element.
  const indentEl = findFieldEl(itemEl, '[data-aue-prop="listItemIndent"]');
  const variantEl = findFieldEl(itemEl, '[data-aue-prop="listItemNestedVariant"]');
  const styleOrderedEl = findFieldEl(itemEl, '[data-aue-prop="listItemNestedStyleOrdered"]');
  const styleUnorderedEl = findFieldEl(itemEl, '[data-aue-prop="listItemNestedStyleUnordered"]');
  // Legacy single-field name from before the ordered/unordered split.
  const styleLegacyEl = findFieldEl(itemEl, '[data-aue-prop="listItemNestedStyle"]');
  const startEl = findFieldEl(itemEl, '[data-aue-prop="listItemStartValue"]');
  const contentEl = findFieldEl(itemEl, '[data-aue-prop="listItemTextContent"]');

  const ueDetected = !!(
    indentEl || variantEl || styleOrderedEl || styleUnorderedEl
    || styleLegacyEl || startEl || contentEl
  );

  if (ueDetected) {
    if (indentEl) {
      const raw = indentEl.textContent.trim();
      if (INDENT_TOKENS.has(raw)) indent = parseInt(raw, 10);
    }
    if (variantEl) {
      const raw = variantEl.textContent.trim();
      if (LIST_TYPES.has(raw)) nestedVariant = raw;
    }
    // Prefer the variant-specific style cell; fall back to legacy, then to
    // whichever style cell carries a recognised value.
    [styleOrderedEl, styleUnorderedEl, styleLegacyEl].forEach((el) => {
      if (!el || nestedStyle) return;
      const raw = el.textContent.trim();
      if (ORDERED_STYLES.has(raw) || ICON_STYLES.has(raw)) nestedStyle = raw;
    });
    if (startEl) startValue = startEl.textContent.trim();
    if (contentEl) contentRow = contentEl;
  } else {
    // Legacy/preview HTML path: positional cells, no data-aue-prop. Each cell
    // is wrapped in an extra div per the drafts shape.
    const cells = [...itemEl.children].map(resolveCell);
    if (cells.length) {
      contentRow = cells[cells.length - 1];
      const settings = cells.slice(0, -1);
      settings.forEach((cell) => {
        const raw = cell.textContent.trim();
        if (!raw) return;
        const token = raw.toLowerCase();
        if (INDENT_TOKENS.has(token) && indent === 0) indent = parseInt(token, 10);
        else if (LIST_TYPES.has(token)) nestedVariant = token;
        else if (ORDERED_STYLES.has(token) || ICON_STYLES.has(token)) nestedStyle = token;
        else if (!startValue) startValue = raw;
      });
    }
  }

  return {
    indent, nestedVariant, nestedStyle, startValue, contentRow,
  };
}

/**
 * Resolve the variant + style of a sub-list this item opens. Falls back to
 * the parent's variant/style when the author leaves Inherit.
 * @param {{ nestedVariant: string, nestedStyle: string }} item
 * @param {{ variant: string, style: string }} parent
 */
function resolveNestedStyle(item, parent) {
  if (!item.nestedVariant) {
    return { variant: parent.variant, style: parent.style };
  }
  if (item.nestedVariant === 'ordered') {
    const style = ORDERED_STYLES.has(item.nestedStyle) ? item.nestedStyle : 'decimal';
    return { variant: 'ordered', style };
  }
  // Unordered: allow icon styles or empty (default bullet).
  const style = ICON_STYLES.has(item.nestedStyle) ? item.nestedStyle : '';
  return { variant: 'unordered', style };
}

/**
 * Create an <ol> or <ul> for the given variant + style. Applies style classes
 * on the list itself so nested or sibling lists can override.
 * @param {string} variant
 * @param {string} style
 */
function createList(variant, style) {
  const list = document.createElement(variant === 'ordered' ? 'ol' : 'ul');
  list.classList.add('list-items-list');
  if (variant === 'unordered' && ICON_STYLES.has(style)) {
    list.classList.add(style, 'list-items-icons');
  } else if (variant === 'ordered' && ORDERED_STYLES.has(style)) {
    list.classList.add(style);
  }
  return list;
}

/**
 * Build a single <li> from a parsed item, including an icon span when the
 * surrounding list uses an icon style.
 * @param {{ contentRow: Element|null }} item
 * @param {Element} originalRow Original list-item element for instrumentation
 * @param {{ style: string }} currentList
 * @param {number} index 1-based position within the current list
 */
function buildLi(item, originalRow, currentList, index) {
  const li = document.createElement('li');
  moveInstrumentation(originalRow, li);

  if (ICON_STYLES.has(currentList.style)) {
    const iconSpan = document.createElement('span');
    iconSpan.classList.add('icon', `icon-${currentList.style}`);
    li.appendChild(iconSpan);
  }

  if (item.contentRow) {
    const cell = item.contentRow.querySelector(':scope > div') || item.contentRow;
    const wrapper = document.createElement('div');
    wrapper.classList.add('list-item-content');
    wrapper.classList.add(`list-item-${index}`);
    moveInstrumentation(cell, wrapper);
    while (cell.firstChild) wrapper.append(cell.firstChild);
    li.appendChild(wrapper);
  }

  return li;
}

/**
 * Build the (possibly nested) list tree from parsed items into the given
 * root element which must already be attached to `block`.
 * @param {Array} items   Parsed items
 *   { indent, nestedVariant, nestedStyle, startValue, contentRow, originalRow }
 * @param {{ variant: string, listStyle: string }} containerSettings
 * @param {Element} root  The top-level <ol>/<ul>, already attached to block
 * @param {Element} block The block element (sibling-split anchor at depth 0)
 * @returns {{ hasIcons: boolean }}
 */
function buildTree(items, containerSettings, root, block) {
  let hasIcons = ICON_STYLES.has(containerSettings.listStyle)
    && containerSettings.variant === 'unordered';
  const stack = [{
    list: root,
    parent: block,
    depth: 0,
    variant: containerSettings.variant,
    style: containerSettings.listStyle,
    count: 0,
  }];

  items.forEach((item) => {
    // Clamp indent: cannot jump more than one level deeper than current top
    // and never exceeds MAX_DEPTH.
    const top = stack[stack.length - 1];
    const target = Math.min(Math.max(0, item.indent), Math.min(MAX_DEPTH, top.depth + 1));

    // Close levels that are deeper than the target depth.
    while (stack.length > 1 && stack[stack.length - 1].depth > target) {
      stack.pop();
    }

    // Open a deeper sub-list when needed.
    if (target > stack[stack.length - 1].depth) {
      const parentFrame = stack[stack.length - 1];
      const parentLi = parentFrame.list.lastElementChild || (() => {
        const placeholder = document.createElement('li');
        parentFrame.list.appendChild(placeholder);
        parentFrame.count += 1;
        return placeholder;
      })();
      const resolved = resolveNestedStyle(item, parentFrame);
      const subList = createList(resolved.variant, resolved.style);
      parentLi.appendChild(subList);
      if (resolved.variant === 'unordered' && ICON_STYLES.has(resolved.style)) hasIcons = true;
      stack.push({
        list: subList,
        parent: parentLi,
        depth: target,
        variant: resolved.variant,
        style: resolved.style,
        count: 0,
      });
    }

    // Per-item restart for ordered lists: set start on the current list when
    // we're at its first child, otherwise split into a sibling <ol start="N">.
    const current = stack[stack.length - 1];
    if (current.variant === 'ordered' && item.startValue) {
      const start = parseStart(item.startValue);
      if (start !== null) {
        if (current.count === 0) {
          current.list.setAttribute('start', String(start));
        } else {
          const sibling = createList(current.variant, current.style);
          sibling.setAttribute('start', String(start));
          current.parent.appendChild(sibling);
          current.list = sibling;
          current.count = 0;
        }
      }
    }

    current.count += 1;
    const li = buildLi(item, item.originalRow, current, current.count);
    current.list.appendChild(li);
  });

  return { hasIcons };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const children = [...block.children];
  // An item row is either explicitly marked by Universal Editor or, in plain
  // preview/drafts HTML, structurally has more than one direct child div (one
  // per field). Settings rows have exactly one direct child div.
  const isItem = (el) => (
    el.matches('[data-aue-component="list-item"]')
    || el.querySelectorAll(':scope > div').length > 1
  );
  const itemEls = children.filter(isItem);
  const settingRows = children.filter((el) => !isItem(el));

  const settings = parseContainerSettings(settingRows);
  const parsedItems = itemEls.map((el) => ({
    ...parseItem(el),
    originalRow: el,
  }));

  // Apply variant/style classes onto the block so it can be targeted in CSS
  // independently of nested list classes.
  block.classList.add(settings.variant);
  if (settings.listStyle) block.classList.add(settings.listStyle);
  if (settings.variant === 'unordered' && ICON_STYLES.has(settings.listStyle)) {
    block.classList.add('list-items-icons');
  }

  block.textContent = '';
  const root = createList(settings.variant, settings.listStyle);
  // Apply top-level start before building so per-item restarts can override
  // by splitting into sibling lists if needed.
  if (settings.variant === 'ordered') {
    const start = parseStart(settings.startValue);
    if (start !== null) root.setAttribute('start', String(start));
  }
  block.appendChild(root);

  const { hasIcons } = buildTree(parsedItems, settings, root, block);

  if (hasIcons) {
    decorateIcons(block);
    await inlineSVGs(block);
  }
}
