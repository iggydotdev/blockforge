import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Injects a reusable SVG clipPath definition into the document body (once).
 *
 * The path is derived from the Figma design (viewBox 0 0 3893 2500), shifted
 * into the image panel's local coordinate space (panel starts at x≈1599),
 * then normalised to objectBoundingBox (0–1) by dividing x by 2294, y by 2500.
 *
 * Original Figma path (full canvas):
 *   M1599 0 l2 713 c-185.162 212.507 -535.125 337.26 -699.171 147.418
 *   L212 83.704 C156.47 26.094 82.1 1.118 1.04 1 H142 Z
 *
 * The path traces the concave left boundary of the image panel. After the
 * boundary the shape extends H-0.63514 V1 H1 V0 to close around the full
 * right panel area, making the image visible everywhere except the concave notch.
 */
const CLIP_PATH_D = 'M0 0 l0.00087 0.2852 c-0.08074 0.085 -0.23327 0.1349 -0.3048 0.059 L-0.60462 0.03348 C-0.62878 0.01044 -0.66131 0.000447 -0.6966 0.0004 H-0.63514 V1 H1 V0 Z';

function ensureClipPath(block) {
  const svgId = 'banner-clip-svg';
  if (document.getElementById(svgId)) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = svgId;
  svg.setAttribute('viewBox', '0 0 1 1');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipPath.id = 'banner-image-clip';
  clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', CLIP_PATH_D);

  clipPath.append(path);
  defs.append(clipPath);
  svg.append(defs);
  block.prepend(svg);
}

/**
 * Loads and decorates the Banner block.
 *
 * Authored row order (Universal Editor, one row per model field):
 *   Row 0 – image     (picture element; imageAlt collapsed into alt attribute)
 *   Row 1 – heading   (plain text → <h2>)
 *   Row 2 – text      (richtext → body copy)
 *   Row 3 – link      (anchor; linkText/linkTitle collapsed into anchor)
 *
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  const [imageRow, headingRow, bodyRow, linkRow] = rows;

  // Outer wrapper (constrains max-width; background stays full-bleed on .banner)
  const inner = document.createElement('div');
  inner.className = 'banner-inner';

  // ── Left panel: text content ──────────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'banner-content';

  const headingText = headingRow?.textContent?.trim() ?? '';
  if (headingText) {
    const h2 = document.createElement('h2');
    h2.className = 'banner-heading';
    h2.textContent = headingText;
    moveInstrumentation(headingRow, h2);
    content.append(h2);
  }

  if (bodyRow) {
    const body = document.createElement('div');
    body.className = 'banner-body';
    const cell = bodyRow.firstElementChild;
    if (cell) {
      while (cell.firstChild) body.append(cell.firstChild);
    }
    moveInstrumentation(bodyRow, body);
    content.append(body);
  }

  const anchor = linkRow?.querySelector('a[href]');
  if (anchor) {
    anchor.classList.add('banner-cta');
    const ctas = document.createElement('div');
    ctas.className = 'banner-ctas';
    ctas.append(anchor);
    moveInstrumentation(linkRow, ctas);
    content.append(ctas);
  }

  // ── Right panel: image ────────────────────────────────────────────────────
  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'banner-media-wrap';

  const media = document.createElement('div');
  media.className = 'banner-media';

  const picture = imageRow?.querySelector('picture');
  if (picture) {
    media.append(picture);
    moveInstrumentation(imageRow, media);
  }

  mediaWrap.append(media);
  inner.append(content, mediaWrap);
  block.replaceChildren(inner);
  ensureClipPath(block);

  // Optimise image – eager LCP image at large size, smaller on mobile
  media.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, true, [
      { media: '(min-width: 900px)', width: '860' },
      { width: '750' },
    ]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });
}
