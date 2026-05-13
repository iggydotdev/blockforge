import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

let lightboxEl;
let lightboxItems = [];
let lightboxIndex = 0;
let lightboxOpener;

function showLightboxAt(idx) {
  if (!lightboxItems.length) return;
  const total = lightboxItems.length;
  lightboxIndex = ((idx % total) + total) % total;
  const item = lightboxItems[lightboxIndex];
  const dlg = lightboxEl;
  const imageWrap = dlg.querySelector('.gallery-lightbox-image');
  const captionEl = dlg.querySelector('.gallery-lightbox-caption');

  imageWrap.replaceChildren();
  const sourcePic = item.picture?.cloneNode(true);
  if (sourcePic) {
    const img = sourcePic.querySelector('img');
    if (img) {
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.loading = 'eager';
    }
    imageWrap.append(sourcePic);
  }

  captionEl.innerHTML = item.caption || '';
  captionEl.hidden = !item.caption;
}

function getLightbox() {
  if (lightboxEl) return lightboxEl;

  lightboxEl = document.createElement('dialog');
  lightboxEl.className = 'gallery-lightbox';
  lightboxEl.innerHTML = `
    <button type="button" class="gallery-lightbox-close" aria-label="Close">&times;</button>
    <button type="button" class="gallery-lightbox-prev" aria-label="Previous image">&#8249;</button>
    <figure class="gallery-lightbox-figure">
      <div class="gallery-lightbox-image"></div>
      <figcaption class="gallery-lightbox-caption"></figcaption>
    </figure>
    <button type="button" class="gallery-lightbox-next" aria-label="Next image">&#8250;</button>
  `;

  lightboxEl.querySelector('.gallery-lightbox-close').addEventListener('click', () => lightboxEl.close());
  lightboxEl.querySelector('.gallery-lightbox-prev').addEventListener('click', () => showLightboxAt(lightboxIndex - 1));
  lightboxEl.querySelector('.gallery-lightbox-next').addEventListener('click', () => showLightboxAt(lightboxIndex + 1));

  lightboxEl.addEventListener('click', (e) => {
    if (e.target === lightboxEl) lightboxEl.close();
  });

  lightboxEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showLightboxAt(lightboxIndex - 1);
    if (e.key === 'ArrowRight') showLightboxAt(lightboxIndex + 1);
  });

  lightboxEl.addEventListener('close', () => {
    if (lightboxOpener && typeof lightboxOpener.focus === 'function') lightboxOpener.focus();
  });

  document.body.append(lightboxEl);
  return lightboxEl;
}

function openLightbox(items, idx, opener) {
  lightboxItems = items;
  lightboxOpener = opener;
  const dlg = getLightbox();
  showLightboxAt(idx);
  if (!dlg.open) dlg.showModal();
}

function initCarousel(block, ul) {
  const track = document.createElement('div');
  track.className = 'gallery-track';
  track.append(ul);

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'gallery-nav gallery-prev';
  prev.setAttribute('aria-label', 'Previous');
  prev.innerHTML = '&#8249;';

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'gallery-nav gallery-next';
  next.setAttribute('aria-label', 'Next');
  next.innerHTML = '&#8250;';

  const scrollByOne = (dir) => {
    const first = ul.querySelector('li');
    if (!first) return;
    const step = first.getBoundingClientRect().width
      + parseFloat(getComputedStyle(ul).columnGap || 0);
    ul.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  prev.addEventListener('click', () => scrollByOne(-1));
  next.addEventListener('click', () => scrollByOne(1));

  track.append(prev, next);
  return track;
}

export default function decorate(block) {
  // Read variants from block classes.
  const cols = ['2', '3', '4'].find((n) => block.classList.contains(`cols-${n}`)) || '3';
  const aspect = ['square', '16-9', 'auto'].find((a) => block.classList.contains(a)) || 'square';
  block.dataset.columns = cols;
  block.dataset.aspect = aspect;

  // Build gallery items from block rows (row = one gallery-item).
  const ul = document.createElement('ul');
  ul.className = 'gallery-items';

  const lightboxData = [];

  [...block.children].forEach((row, idx) => {
    const li = document.createElement('li');
    li.className = 'gallery-item';
    moveInstrumentation(row, li);
    ul.append(li);

    const cells = [...row.children];
    const picture = cells[0]?.querySelector('picture');
    const captionHTML = cells[1]?.innerHTML?.trim() || '';

    // Empty/in-progress items in the editor have no picture yet — keep the
    // <li> in the DOM (with its UE instrumentation) so authors can still
    // select and edit it, but skip the figure/lightbox wiring.
    if (!picture) {
      li.classList.add('gallery-item-empty');
      if (captionHTML) {
        const figcaption = document.createElement('figcaption');
        figcaption.className = 'gallery-caption';
        figcaption.innerHTML = captionHTML;
        li.append(figcaption);
      }
      return;
    }

    const figure = document.createElement('figure');
    figure.className = 'gallery-figure';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-thumb';
    button.setAttribute('aria-label', `Open image ${idx + 1}`);
    button.append(picture);
    figure.append(button);

    if (captionHTML) {
      const figcaption = document.createElement('figcaption');
      figcaption.className = 'gallery-caption';
      figcaption.innerHTML = captionHTML;
      figure.append(figcaption);
    }

    li.append(figure);

    lightboxData.push({ picture, caption: captionHTML });

    button.addEventListener('click', () => openLightbox(lightboxData, idx, button));
  });

  // Optimize images.
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  // Refresh lightboxData picture refs to point at the optimized DOM nodes.
  [...ul.querySelectorAll('picture')].forEach((pic, i) => {
    if (lightboxData[i]) lightboxData[i].picture = pic;
  });

  if (block.classList.contains('carousel')) {
    block.replaceChildren(initCarousel(block, ul));
  } else {
    block.replaceChildren(ul);
  }
}
