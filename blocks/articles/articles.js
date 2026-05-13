import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Articles — grid of article cards (image + tag + title + read link).
 * Pair with a section using the "Section Header Row" style to put a heading
 * and an "Explore all articles" CTA above the grid.
 *
 * Authored row order per item (model fields, after Alt/Text suffix collapse):
 *   0: image (with imageAlt embedded as alt)
 *   1: tag           (plain text)
 *   2: tagVariant    (plain text — class name)
 *   3: title         (plain text)
 *   4: link          (anchor; linkText is the anchor text)
 *
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'articles-list';

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'article-card';
    moveInstrumentation(row, li);

    const cells = [...row.children];
    const [imageCell, tagCell, variantCell, titleCell, linkCell] = cells;

    // Image with overlaid tag
    const picture = imageCell?.querySelector('picture');
    if (picture) {
      const media = document.createElement('div');
      media.className = 'article-card-media';
      media.append(picture);

      const tagText = tagCell?.textContent.trim() ?? '';
      if (tagText) {
        const tag = document.createElement('span');
        const variant = (variantCell?.textContent.trim() || 'tag-yellow').replace('--', '-');
        tag.className = `article-card-tag ${variant}`;
        tag.textContent = tagText;
        media.append(tag);
      }

      li.append(media);
    }

    // Title
    const titleText = titleCell?.textContent.trim() ?? '';
    if (titleText) {
      const h3 = document.createElement('h3');
      h3.className = 'article-card-title';
      h3.textContent = titleText;
      moveInstrumentation(titleCell, h3);
      li.append(h3);
    }

    // Read link (with arrow icon added via CSS ::before)
    const anchor = linkCell?.querySelector('a[href]');
    if (anchor) {
      const linkWrap = document.createElement('div');
      linkWrap.className = 'article-card-link';
      anchor.classList.add('article-card-read');
      linkWrap.append(anchor);
      moveInstrumentation(linkCell, linkWrap);
      li.append(linkWrap);
    }

    ul.append(li);
  });

  // Optimise images.
  ul.querySelectorAll('.article-card-media picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(
      img.src,
      img.alt,
      false,
      [{ width: '500' }],
    );
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  block.replaceChildren(ul);
}
