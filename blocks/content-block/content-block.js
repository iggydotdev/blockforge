import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} block
 */
export default function decorate(block) {
  if (block.classList.contains('content-block--image-right')) {
    block.classList.replace('content-block--image-right', 'content-block-image-right');
  }

  const rows = [...block.children];
  // Cell order matches the model:
  // image, eyebrow, title, text (richtext), cta link
  const [imageRow, eyebrowRow, titleRow, textRow, ctaRow] = rows;

  const picture = imageRow?.querySelector('picture');
  const eyebrow = eyebrowRow?.textContent.trim() ?? '';
  const titleText = titleRow?.textContent.trim() ?? '';
  const ctaAnchor = ctaRow?.querySelector('a[href]');
  // Grouped CTA cell contains: <a>, plus <p>s for cta_linkText and cta_linkType.
  const ctaParas = ctaRow ? [...ctaRow.querySelectorAll('p')] : [];
  const knownVariants = ['primary', 'secondary', 'tertiary'];
  const ctaType = ctaParas
    .map((p) => p.textContent.trim())
    .find((t) => knownVariants.includes(t)) || '';
  const ctaText = ctaParas
    .map((p) => p.textContent.trim())
    .find((t) => t && !knownVariants.includes(t))
    || ctaAnchor?.textContent.trim()
    || '';

  // Body side
  const body = document.createElement('div');
  body.className = 'content-block-body';

  if (eyebrow) {
    const eb = document.createElement('p');
    eb.className = 'content-block-eyebrow';
    eb.textContent = eyebrow;
    body.append(eb);
  }

  if (titleText) {
    const heading = document.createElement('h2');
    heading.className = 'content-block-title';
    heading.textContent = titleText;
    body.append(heading);
  }

  if (textRow) {
    const richtext = document.createElement('div');
    richtext.className = 'content-block-text';
    while (textRow.firstChild) richtext.append(textRow.firstChild);
    moveInstrumentation(textRow, richtext);
    if (richtext.childNodes.length) body.append(richtext);
  }

  if (ctaAnchor) {
    ctaAnchor.classList.add('button', 'content-block-cta');
    if (ctaType) ctaAnchor.classList.add(ctaType);
    if (ctaText) ctaAnchor.textContent = ctaText;
    body.append(ctaAnchor);
  }

  // Media side — only render the figure if an image was authored.
  const newChildren = [];
  if (picture) {
    const figure = document.createElement('figure');
    figure.className = 'content-block-media';
    figure.append(picture);
    figure.querySelectorAll('picture > img').forEach((img) => {
      const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '900' }]);
      moveInstrumentation(img, optimized.querySelector('img'));
      img.closest('picture').replaceWith(optimized);
    });
    newChildren.push(figure);
  } else {
    block.classList.add('content-block-no-image');
  }
  newChildren.push(body);

  block.replaceChildren(...newChildren);
}
