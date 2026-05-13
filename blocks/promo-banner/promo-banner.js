import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} block
 */
export default function decorate(block) {
  ['promo-banner--light', 'promo-banner--half'].forEach((className) => {
    if (block.classList.contains(className)) block.classList.replace(className, className.replace('--', '-'));
  });

  const rows = [...block.children];
  // Cell order matches the model: image, badge, content (richtext), link
  const [imageRow, badgeRow, contentRow, linkRow] = rows;

  const picture = imageRow?.querySelector('picture');
  const badge = badgeRow?.textContent.trim() ?? '';
  const anchor = linkRow?.querySelector('a[href]');
  const href = anchor?.getAttribute('href') ?? '';

  // Build the card: <a> when linked, <article> otherwise.
  const card = document.createElement(href ? 'a' : 'article');
  card.classList.add('promo-banner-card');
  if (href) {
    card.href = href;
  }

  // Media side
  const media = document.createElement('div');
  media.className = 'promo-banner-media';
  if (picture) media.append(picture);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'promo-banner-badge';
    badgeEl.textContent = badge;
    media.append(badgeEl);
  }

  // Body side — pull richtext content directly from the row.
  const body = document.createElement('div');
  body.className = 'promo-banner-body';
  if (contentRow) {
    while (contentRow.firstChild) body.append(contentRow.firstChild);
    moveInstrumentation(contentRow, body);
  }

  card.append(media, body);

  // Set anchor accessible name from the heading text.
  if (href) {
    const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) card.setAttribute('aria-label', heading.textContent.trim());
  }

  // Optimise image
  card.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '900' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  moveInstrumentation(block, card);
  block.replaceChildren(card);
}
