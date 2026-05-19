import { decorateIcons } from '../../scripts/aem.js';
import { inlineSVGs } from '../../scripts/scripts.js';

const ORDERED_STYLES = ['decimal', 'upper-roman', 'upper-alpha', 'lower-alpha'];
const ICON_NAMES = ['checkmark', 'right-arrow', 'star', 'circle', 'square'];

/**
 * Separate block-level setting rows from list-item content rows.
 * UE row-per-field: the container model has 3 fields (listVariant, orderedStyle, icon),
 * so the first 3 rows are always settings. Remaining rows are authored items.
 */
function parseRows(block) {
  const allRows = [...block.children];
  const settings = {};

  // The container model defines 3 fields — consume those rows as settings.
  const settingsCount = 3;
  const settingRows = allRows.slice(0, settingsCount);
  const items = allRows.slice(settingsCount);

  settingRows.forEach((row) => {
    const text = row.textContent.trim().toLowerCase();
    if (text === 'ordered' || text === 'unordered') {
      settings.listVariant = text;
    } else if (ORDERED_STYLES.includes(text)) {
      settings.orderedStyle = text;
    } else if (ICON_NAMES.includes(text)) {
      settings.icon = text;
    }
    row.remove();
  });

  return { settings, items };
}

export default async function decorate(block) {
  const { settings, items } = parseRows(block);

  const isOrdered = settings.listVariant === 'ordered';
  const list = document.createElement(isOrdered ? 'ol' : 'ul');
  list.classList.add('list-items-list');

  if (isOrdered && settings.orderedStyle) {
    list.style.listStyleType = settings.orderedStyle;
  }

  const iconName = !isOrdered && settings.icon ? settings.icon : '';
  if (iconName) {
    block.classList.add('list-items-icons');
  }

  items.forEach((row, index) => {
    const li = document.createElement('li');
    const content = row.querySelector('div');

    if (iconName) {
      const iconSpan = document.createElement('span');
      iconSpan.classList.add('icon', `icon-${iconName}`);
      li.appendChild(iconSpan);
    }

    if (content) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('list-item-content', `list-item-content-${index}`);
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
