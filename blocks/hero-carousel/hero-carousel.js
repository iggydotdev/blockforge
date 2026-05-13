import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Concave clip-path used for the right-hand image panel of each slide.
 * Mirrors the shape used by the standalone Banner block. See banner.js.
 */
const CLIP_PATH_D = 'M0 0 l0.00087 0.2852 c-0.08074 0.085 -0.23327 0.1349 -0.3048 0.059 L-0.60462 0.03348 C-0.62878 0.01044 -0.66131 0.000447 -0.6966 0.0004 H-0.63514 V1 H1 V0 Z';
const CLIP_ID = 'hero-carousel-image-clip';
const AUTOPLAY_INTERVAL_MS = 6000;
const timers = new WeakMap();

function ensureClipPath(host) {
  if (host.querySelector(`#${CLIP_ID}-svg`)) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = `${CLIP_ID}-svg`;
  svg.setAttribute('viewBox', '0 0 1 1');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipPath.id = CLIP_ID;
  clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', CLIP_PATH_D);

  clipPath.append(path);
  defs.append(clipPath);
  svg.append(defs);
  host.prepend(svg);
}

/**
 * Universal Editor delivers each child item (`hero-slide`) as a `<div>` row
 * inside the block. Each slide has its own one-row-per-field structure:
 *   Row 0 – image
 *   Row 1 – heading
 *   Row 2 – text (richtext)
 *   Row 3 – primary CTA (anchor)
 *   Row 4 – secondary CTA (anchor)
 */
function buildSlide(slideEl, index, total) {
  const fieldRows = [...slideEl.children];
  const [imageRow, headingRow, textRow, primaryRow, secondaryRow] = fieldRows;

  const slide = document.createElement('li');
  slide.classList.add('hero-carousel-slide');
  slide.dataset.slideIndex = index;
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'slide');
  slide.setAttribute('aria-label', `${index + 1} of ${total}`);
  moveInstrumentation(slideEl, slide);

  // ── Content panel (left) ────────────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'hero-carousel-content';

  const headingText = headingRow?.textContent?.trim() ?? '';
  if (headingText) {
    const h2 = document.createElement('h2');
    h2.className = 'hero-carousel-heading';
    h2.textContent = headingText;
    moveInstrumentation(headingRow, h2);
    content.append(h2);
  }

  if (textRow) {
    const body = document.createElement('div');
    body.className = 'hero-carousel-body';
    const cell = textRow.firstElementChild;
    if (cell) {
      while (cell.firstChild) body.append(cell.firstChild);
    }
    moveInstrumentation(textRow, body);
    content.append(body);
  }

  // CTAs — primary (filled yellow) + secondary (ghost outline)
  const ctas = document.createElement('div');
  ctas.className = 'hero-carousel-ctas';

  const primaryAnchor = primaryRow?.querySelector('a[href]');
  if (primaryAnchor) {
    primaryAnchor.classList.add('hero-carousel-cta', 'hero-carousel-cta-primary');
    moveInstrumentation(primaryRow, primaryAnchor);
    ctas.append(primaryAnchor);
  }

  const secondaryAnchor = secondaryRow?.querySelector('a[href]');
  if (secondaryAnchor) {
    secondaryAnchor.classList.add('hero-carousel-cta', 'hero-carousel-cta-secondary');
    moveInstrumentation(secondaryRow, secondaryAnchor);
    ctas.append(secondaryAnchor);
  }

  if (ctas.children.length) content.append(ctas);

  // ── Media panel (right) ─────────────────────────────────────────────────
  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'hero-carousel-media-wrap';

  const media = document.createElement('div');
  media.className = 'hero-carousel-media';

  const picture = imageRow?.querySelector('picture');
  if (picture) {
    media.append(picture);
    moveInstrumentation(imageRow, media);
  }
  mediaWrap.append(media);

  slide.append(content, mediaWrap);
  return slide;
}

function buildIndicators(total) {
  const nav = document.createElement('nav');
  nav.className = 'hero-carousel-indicators';
  nav.setAttribute('aria-label', 'Slide navigation');

  const list = document.createElement('ol');
  for (let i = 0; i < total; i += 1) {
    const li = document.createElement('li');
    li.className = 'hero-carousel-indicator';

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.targetSlide = i;
    button.setAttribute('aria-label', `Show slide ${i + 1} of ${total}`);
    button.textContent = String(i + 1).padStart(2, '0');
    li.append(button);
    list.append(li);
  }
  nav.append(list);

  // Progress track between active and next indicator
  const progress = document.createElement('div');
  progress.className = 'hero-carousel-progress';
  progress.innerHTML = '<span class="hero-carousel-progress-fill"></span>';
  nav.append(progress);

  // Play / pause toggle
  const playPause = document.createElement('button');
  playPause.type = 'button';
  playPause.className = 'hero-carousel-playpause';
  playPause.dataset.state = 'playing';
  playPause.setAttribute('aria-label', 'Pause autoplay');
  nav.append(playPause);

  return nav;
}

function setActive(block, index) {
  const slides = block.querySelectorAll('.hero-carousel-slide');
  const buttons = block.querySelectorAll('.hero-carousel-indicator button');
  const total = slides.length;
  const next = ((index % total) + total) % total;

  slides.forEach((s, i) => {
    s.classList.toggle('is-active', i === next);
    s.setAttribute('aria-hidden', i !== next);
    s.querySelectorAll('a').forEach((a) => {
      if (i === next) a.removeAttribute('tabindex');
      else a.setAttribute('tabindex', '-1');
    });
  });

  buttons.forEach((b, i) => {
    b.classList.toggle('is-active', i === next);
    if (i === next) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });

  block.dataset.activeSlide = next;
  // Restart progress animation
  const fill = block.querySelector('.hero-carousel-progress-fill');
  if (fill) {
    fill.style.animation = 'none';
    // Force reflow so the animation restarts
    // eslint-disable-next-line no-unused-expressions
    fill.offsetHeight;
    fill.style.animation = '';
  }
}

function stopTimer(block) {
  const id = timers.get(block);
  if (id) {
    clearInterval(id);
    timers.delete(block);
  }
}

function restartTimer(block) {
  stopTimer(block);
  const id = setInterval(() => {
    const current = parseInt(block.dataset.activeSlide || '0', 10);
    setActive(block, current + 1);
  }, AUTOPLAY_INTERVAL_MS);
  timers.set(block, id);
}

function bindEvents(block) {
  block.querySelectorAll('.hero-carousel-indicator button').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActive(block, parseInt(btn.dataset.targetSlide, 10));
      restartTimer(block);
    });
  });

  const playPause = block.querySelector('.hero-carousel-playpause');
  playPause.addEventListener('click', () => {
    const isPlaying = playPause.dataset.state === 'playing';
    if (isPlaying) {
      stopTimer(block);
      playPause.dataset.state = 'paused';
      playPause.setAttribute('aria-label', 'Play autoplay');
      block.classList.add('is-paused');
    } else {
      playPause.dataset.state = 'playing';
      playPause.setAttribute('aria-label', 'Pause autoplay');
      block.classList.remove('is-paused');
      restartTimer(block);
    }
  });

  // Pause autoplay when user hovers / focuses inside the carousel
  block.addEventListener('mouseenter', () => stopTimer(block));
  block.addEventListener('mouseleave', () => {
    if (block.querySelector('.hero-carousel-playpause').dataset.state === 'playing') {
      restartTimer(block);
    }
  });
}

export default async function decorate(block) {
  const slideRows = [...block.children];
  const total = slideRows.length;

  const slidesList = document.createElement('ul');
  slidesList.className = 'hero-carousel-slides';
  slidesList.setAttribute('aria-live', 'polite');

  slideRows.forEach((row, idx) => {
    const slide = buildSlide(row, idx, total);
    slidesList.append(slide);
  });

  const indicators = total > 1 ? buildIndicators(total) : null;

  // Replace original rows with the carousel structure
  block.replaceChildren(slidesList);
  if (indicators) block.append(indicators);
  ensureClipPath(block);

  // Optimise images for LCP — first slide loaded eagerly, rest lazy
  block.querySelectorAll('.hero-carousel-media picture > img').forEach((img, idx) => {
    const eager = idx === 0;
    const optimized = createOptimizedPicture(img.src, img.alt, eager, [
      { media: '(min-width: 900px)', width: '860' },
      { width: '750' },
    ]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  setActive(block, 0);

  if (total > 1) {
    bindEvents(block);
    restartTimer(block);
  }
}
