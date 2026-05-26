import { decorateIcons } from '../../scripts/aem.js';
import { inlineSVGs, moveInstrumentation } from '../../scripts/scripts.js';

const LIST_TYPES = new Set(['ordered', 'unordered']);
const ORDERED_STYLES = new Set([
  'decimal',
  'upper-roman',
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
const NESTED_STYLE_TOKENS = new Set([
  'ordered-decimal',
  'ordered-upper-roman',
  'ordered-upper-alpha',
  'ordered-lower-alpha',
  'unordered-default',
  'unordered-checkmark',
  'unordered-right-arrow',
  'unordered-star',
  'unordered-circle',
  'unordered-square',
]);
const MAX_DEPTH = 2;
const ROMAN_VALUES = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
};

/**
 * Convert a Roman numeral string (already uppercased) to an integer.
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
  const s = input.trim();
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
 * Split a nested-style token like "ordered-upper-roman" into
 * { variant, style }. "unordered-default" maps to { unordered, "" }.
 * Returns null if the token isn't recognised.
 * @param {string} token
 */
function splitNestedStyle(token) {
  if (!token || !NESTED_STYLE_TOKENS.has(token)) return null;
  if (token === 'unordered-default') return { variant: 'unordered', style: '' };
  if (token.startsWith('ordered-')) {
    return { variant: 'ordered', style: token.slice('ordered-'.length) };
  }
  if (token.startsWith('unordered-')) {
    return { variant: 'unordered', style: token.slice('unordered-'.length) };
  }
  return null;
}

/**
 * Read container settings from the rows that precede the list-item children.
 * Tokens are matched against known value sets so the parser is tolerant of
 * conditional fields producing 1, 2, or more settings rows.
 * @param {Element[]} settingRows
 */
function parseContainerSettings(settingRows) {
  const settings = { variant: 'unordered', listStyle: '', startValue: '' };
  settingRows.forEach((row) => {
    row.querySelectorAll(':scope > div').forEach((cell) => {
      const raw = cell.textContent.trim();
      if (!raw) return;
      const token = raw.toLowerCase();
      if (LIST_TYPES.has(token)) {
        settings.variant = token;
      } else if (ORDERED_STYLES.has(token) || ICON_STYLES.has(token)) {
        settings.listStyle = token;
      } else if (!settings.startValue) {
        // Unknown token → treat as the free-form start value.
        settings.startValue = raw;
      }
    });
    row.remove();
  });
  return settings;
}

/**
 * Read indent + nestedStyle settings from a list-item row. The content row is
 * identified by [data-aue-prop="listItemTextContent"]; other rows hold setting
 * tokens.
 * @param {Element} itemEl
 * @returns {{ indent: number, nestedStyle: string, contentRow: Element|null }}
 */
function parseItem(itemEl) {
  const rows = [...itemEl.children];
  let contentRow = null;
  const settingRows = [];

  rows.forEach((row) => {
    if (row.querySelector('[data-aue-prop="listItemTextContent"]')) {
      contentRow = row;
    } else {
      settingRows.push(row);
    }
  });

  // Fallback: if no content marker was found (e.g. preview without UE
  // attributes), assume the last row is the content row.
  if (!contentRow && rows.length) {
    contentRow = rows[rows.length - 1];
    const idx = settingRows.indexOf(contentRow);
    if (idx !== -1) settingRows.splice(idx, 1);
  }

  let indent = 0;
  let nestedStyle = '';
  settingRows.forEach((row) => {
    row.querySelectorAll(':scope > div').forEach((cell) => {
      const token = cell.textContent.trim().toLowerCase();
      if (!token) return;
      if (INDENT_TOKENS.has(token)) indent = parseInt(token, 10);
      else if (NESTED_STYLE_TOKENS.has(token)) nestedStyle = token;
    });
  });

  return { indent, nestedStyle, contentRow };
}

/**
 * Create an <ol> or <ul> for the given variant + style. Applies style classes
 * directly on the list element so nested sub-lists can carry their own style.
 * @param {string} variant
 * @param {string} style
 */
function createList(variant, style) {
  const list = document.createElement(variant === 'ordered' ? 'ol' : 'ul');
  list.classList.add('list-items-list');
  if (style) {
    list.classList.add(style);
    if (ICON_STYLES.has(style)) list.classList.add('list-items-icons');
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
 * Build the (possibly nested) list tree from parsed items.
 * @param {Array} items   Array of { indent, nestedStyle, contentRow, originalRow }
 * @param {{ variant: string, listStyle: string }} containerSettings
 * @returns {{ root: Element, hasIcons: boolean }}
 */
function buildTree(items, containerSettings) {
  const root = createList(containerSettings.variant, containerSettings.listStyle);
  const stack = [{
    list: root,
    depth: 0,
    variant: containerSettings.variant,
    style: containerSettings.listStyle,
    count: 0,
  }];
  let hasIcons = ICON_STYLES.has(containerSettings.listStyle);

  items.forEach(({
    indent, nestedStyle, contentRow, originalRow,
  }) => {
    // Clamp indent: cannot jump more than one level deeper than current top
    // and never exceeds MAX_DEPTH.
    const top = stack[stack.length - 1];
    const target = Math.min(Math.max(0, indent), Math.min(MAX_DEPTH, top.depth + 1));

    // Close levels that are deeper than target.
    while (stack.length > 1 && stack[stack.length - 1].depth > target) {
      stack.pop();
    }

    // Open a new sub-list when target is deeper than current top.
    if (target > stack[stack.length - 1].depth) {
      const parent = stack[stack.length - 1];
      const parentLi = parent.list.lastElementChild;
      // If parent list has no <li> yet (author began with an indented item),
      // synthesize an empty <li> so the sub-list has somewhere to attach.
      const attachTo = parentLi || (() => {
        const placeholder = document.createElement('li');
        parent.list.appendChild(placeholder);
        parent.count += 1;
        return placeholder;
      })();
      const resolved = splitNestedStyle(nestedStyle)
        || { variant: parent.variant, style: parent.style };
      const subList = createList(resolved.variant, resolved.style);
      attachTo.appendChild(subList);
      if (ICON_STYLES.has(resolved.style)) hasIcons = true;
      stack.push({
        list: subList,
        depth: target,
        variant: resolved.variant,
        style: resolved.style,
        count: 0,
      });
    }

    const current = stack[stack.length - 1];
    current.count += 1;
    const li = buildLi({ contentRow }, originalRow, current, current.count);
    current.list.appendChild(li);
  });

  return { root, hasIcons };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const children = [...block.children];
  const itemEls = children.filter((el) => el.matches('[data-aue-component="list-item"]'));
  const settingRows = children.filter((el) => !el.matches('[data-aue-component="list-item"]'));

  const settings = parseContainerSettings(settingRows);
  const parsedItems = itemEls.map((el) => ({
    ...parseItem(el),
    originalRow: el,
  }));

  // Apply variant/style classes onto the block itself so it can be targeted in
  // CSS independently of any nested list classes.
  block.classList.add(settings.variant);
  if (settings.listStyle) block.classList.add(settings.listStyle);
  if (ICON_STYLES.has(settings.listStyle)) block.classList.add('list-items-icons');

  const { root, hasIcons } = buildTree(parsedItems, settings);

  // Apply start attribute on the top-level ordered list when provided.
  if (settings.variant === 'ordered') {
    const start = parseStart(settings.startValue);
    if (start !== null) root.setAttribute('start', String(start));
  }

  block.textContent = '';
  block.appendChild(root);

  if (hasIcons) {
    decorateIcons(block);
    await inlineSVGs(block);
  }
}
