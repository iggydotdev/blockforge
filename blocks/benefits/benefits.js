import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'benefits-list';

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);

    const picture = row.querySelector('picture');
    const anchor = [...row.querySelectorAll('a[href]')].find((a) => !a.querySelector('picture'));

    // Label = first non-empty text cell that is not the picture or the link.
    let labelText = '';
    [...row.children].forEach((cell) => {
      if (cell.querySelector('picture')) return;
      if (anchor && cell.contains(anchor)) return;
      const t = cell.textContent.trim();
      if (!labelText && t) labelText = t;
    });

    const tile = document.createElement(anchor ? 'a' : 'div');
    tile.className = 'benefits-tile';
    if (anchor) tile.href = anchor.href;

    const imageWrap = document.createElement('div');
    imageWrap.className = 'benefits-tile-image';
    if (picture) imageWrap.append(picture);
    tile.append(imageWrap);

    if (labelText) {
      const label = document.createElement('span');
      label.className = 'benefits-tile-label';
      label.textContent = labelText;
      tile.append(label);
    }

    li.append(tile);
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '500' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  block.replaceChildren(ul);
}
