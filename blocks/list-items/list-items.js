import { decorateIcons } from '../../scripts/aem.js';
import { inlineSVGs } from '../../scripts/scripts.js';

const ORDERED_STYLES = ['decimal', 'upper-roman', 'upper-alpha', 'lower-alpha'];
const ICON_NAMES = ['checkmark', 'right-arrow', 'star', 'circle', 'square'];

export default async function decorate(block) {
  const rows = [...block.children];

  // First row holds block-level settings (listType, orderedStyle, icon)
  const settingsRow = rows[0];
  const settingCells = settingsRow ? [...settingsRow.children] : [];
  const listType = settingCells[0]?.textContent?.trim().toLowerCase() || 'unordered';
  const variant = settingCells[1]?.textContent?.trim().toLowerCase() || '';
  settingsRow?.remove();

  const isOrdered = listType === 'ordered';
  const list = document.createElement(isOrdered ? 'ol' : 'ul');
  list.classList.add('list-items-list');

  // Apply ordered list style
  if (isOrdered && ORDERED_STYLES.includes(variant)) {
    list.style.listStyleType = variant;
  }

  // Determine icon for unordered lists
  const iconName = !isOrdered && ICON_NAMES.includes(variant) ? variant : '';
  if (iconName) {
    block.classList.add('list-items-icons');
  }

  // Remaining rows are list items
  const itemRows = [...block.children];
  itemRows.forEach((row) => {
    const li = document.createElement('li');
    const content = row.querySelector('div');

    if (iconName) {
      const iconSpan = document.createElement('span');
      iconSpan.classList.add('icon', `icon-${iconName}`);
      li.appendChild(iconSpan);
    }

    if (content) {
      const wrapper = document.createElement('span');
      wrapper.classList.add('list-item-content');
      wrapper.append(...content.childNodes);
      li.appendChild(wrapper);
    }

    list.appendChild(li);
  });

  block.textContent = '';
  block.appendChild(list);

  if (iconName) {
    decorateIcons(block);
    await inlineSVGs(block);
  }
}
