import { decorateIcons } from '../../scripts/aem.js';
import { inlineSVGs } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const rows = [...block.children];
  const anchor = rows[0]?.querySelector('a');
  if (!anchor) return;

  // decorateButtons already ran via decorateBlock, but ensure class is present
  if (!anchor.classList.contains('button')) {
    anchor.classList.add('button');
  }

  // Icon values from the model's select options
  const VALID_ICONS = ['shopping-cart', 'left-arrow', 'right-arrow', 'search'];

  let leftIconName = '';
  let rightIconName = '';
  let boolCount = 0;
  let lastBoolWasTrue = false;

  for (let i = 1; i < rows.length; i += 1) {
    const text = rows[i].textContent.trim().toLowerCase();

    if (text === 'true' || text === 'false') {
      boolCount += 1;
      lastBoolWasTrue = text === 'true';
    } else if (VALID_ICONS.includes(text) && lastBoolWasTrue) {
      // boolCount 1 = hasLeftIcon, boolCount 2 = hasRightIcon
      if (boolCount === 1) leftIconName = text;
      else if (boolCount === 2) rightIconName = text;
    }
  }
  if (leftIconName || rightIconName) {
    // Inject icon spans
    if (leftIconName) {
      const span = document.createElement('span');
      span.classList.add('icon', `icon-${leftIconName}`);
      anchor.prepend(span);
    }
    if (rightIconName) {
      const span = document.createElement('span');
      span.classList.add('icon', `icon-${rightIconName}`);
      anchor.append(span);
    }
  }

  // Rebuild block with clean structure
  block.textContent = '';
  const p = document.createElement('p');
  p.classList.add('button-container');
  p.appendChild(anchor);
  block.appendChild(p);

  decorateIcons(block);
  await inlineSVGs(block);
}
