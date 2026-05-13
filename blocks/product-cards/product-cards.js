import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'product-cards-list';

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'product-card';
    moveInstrumentation(row, li);

    // Field rows in model order: icon, title, text, links
    // (iconAlt collapses onto the icon picture)
    const cells = [...row.children];
    const [iconCell, titleCell, textCell, linksCell] = cells;

    const picture = iconCell?.querySelector('picture');
    const titleText = titleCell?.textContent.trim() ?? '';

    if (picture) {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'product-card-icon';
      iconWrap.append(picture);
      li.append(iconWrap);
    }

    if (titleText) {
      const h3 = document.createElement('h3');
      h3.className = 'product-card-title';
      h3.textContent = titleText;
      moveInstrumentation(titleCell, h3);
      li.append(h3);
    }

    if (textCell && textCell.textContent.trim()) {
      const body = document.createElement('div');
      body.className = 'product-card-text';
      while (textCell.firstChild) body.append(textCell.firstChild);
      moveInstrumentation(textCell, body);
      li.append(body);
    }

    if (linksCell && linksCell.querySelector('a[href]')) {
      const linksWrap = document.createElement('div');
      linksWrap.className = 'product-card-links';
      // Move the authored content (typically a <ul> of links) in as-is.
      while (linksCell.firstChild) linksWrap.append(linksCell.firstChild);
      moveInstrumentation(linksCell, linksWrap);
      li.append(linksWrap);
    }

    ul.append(li);
  });

  // Optimise icons (small width — they're decorative thumbnails).
  ul.querySelectorAll('.product-card-icon picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '160' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  block.replaceChildren(ul);
}
