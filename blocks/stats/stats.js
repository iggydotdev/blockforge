import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'stats-list';

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'stat-item';
    moveInstrumentation(row, li);

    // UE container/item pattern: each row has one wrapper div containing field rows
    const wrapper = row.children.length === 1 ? row.children[0] : row;
    const cells = [...wrapper.children];
    const [valueCell, descriptionCell, iconCell] = cells;

    const valueText = valueCell?.textContent.trim() ?? '';
    if (valueText) {
      const value = document.createElement('p');
      value.className = 'stat-item-value';
      value.textContent = valueText;
      moveInstrumentation(valueCell, value);
      li.append(value);
    }

    const descriptionText = descriptionCell?.textContent.trim() ?? '';
    if (descriptionText) {
      const description = document.createElement('p');
      description.className = 'stat-item-description';
      description.textContent = descriptionText;
      moveInstrumentation(descriptionCell, description);
      li.append(description);
    }

    const picture = iconCell?.querySelector('picture');
    if (picture) {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'stat-item-icon';
      iconWrap.append(picture);
      li.append(iconWrap);
    }

    ul.append(li);
  });

  ul.querySelectorAll('.stat-item-icon picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '96' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  block.replaceChildren(ul);
}
