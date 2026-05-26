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

/**
 * Parse settings rows and item rows from the block.
 * Item rows are identified by data-aue-component="list-item"; everything
 * else is treated as a settings row. This is robust to UE rendering 1, 2,
 * or N settings rows depending on conditional field state.
 *
 * @param {Element} block
 * @returns {{ settings: { listType: string, listStyle: string }, itemRows: Element[] }}
 */
function parseBlock(block) {
  const children = [...block.children];
  const itemRows = children.filter((el) => el.matches('[data-aue-component="list-item"]'));
  const settingRows = children.filter((el) => !el.matches('[data-aue-component="list-item"]'));

  const settings = { variant: 'unordered', listStyle: '' };

  settingRows.forEach((row) => {
    row.querySelectorAll(':scope > div').forEach((cell) => {
      const token = cell.textContent.trim().toLowerCase();
      if (!token) return;
      if (LIST_TYPES.has(token)) {
        settings.variant = token;
      } else if (ORDERED_STYLES.has(token) || ICON_STYLES.has(token)) {
        settings.listStyle = token;
      }
    });
    row.remove();
  });

  return { settings, itemRows };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const { settings, itemRows } = parseBlock(block);
  const { variant, listStyle } = settings;

  const isOrdered = variant === 'ordered';
  const useIcon = !isOrdered && ICON_STYLES.has(listStyle);

  // Apply variant classes onto the block itself so CSS can target them.
  block.classList.add(variant);
  if (listStyle) block.classList.add(listStyle);
  if (useIcon) block.classList.add('list-items-icons');

  const list = document.createElement(isOrdered ? 'ol' : 'ul');
  list.classList.add('list-items-list');

  itemRows.forEach((row, index) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);

    if (useIcon) {
      const iconSpan = document.createElement('span');
      iconSpan.classList.add('icon', `icon-${listStyle}`);
      li.appendChild(iconSpan);
    }

    const content = row.querySelector(':scope > div');
    if (content) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('list-item-content');
      wrapper.classList.add(`list-item-${index + 1}`);
      moveInstrumentation(content, wrapper);
      while (content.firstChild) wrapper.append(content.firstChild);
      li.appendChild(wrapper);
    }

    list.appendChild(li);
  });

  block.textContent = '';
  block.appendChild(list);

  if (useIcon) {
    decorateIcons(block);
    await inlineSVGs(block);
  }
}
