import { decorateBlock, loadBlock } from '../../scripts/aem.js';

// Block names allowed as children of a column (mirrors the column filter in _columns.json).
const NESTED_BLOCK_NAMES = new Set([
  'text',
  'image',
  'button',
  'title',
  'card',
  'accordion',
  'divider',
  'video',
  'quote',
]);

/**
 * Find direct block descendants inside the columns block and decorate/load them.
 * Nested blocks aren't picked up by the framework's top-level decorateBlocks/loadSection
 * pass, so we wire them up here.
 * @param {Element} block The columns block element
 */
async function decorateNestedBlocks(block) {
  const candidates = [...block.querySelectorAll('[data-aue-component], [data-aue-model]')];
  const nested = candidates.filter((el) => {
    const name = el.dataset.aueComponent || el.dataset.aueModel || el.classList[0];
    return name && NESTED_BLOCK_NAMES.has(name) && !el.dataset.blockStatus;
  });

  nested.forEach((el) => {
    const name = el.dataset.aueComponent || el.dataset.aueModel || el.classList[0];
    if (!el.classList.contains(name)) el.classList.add(name);
    decorateBlock(el);
  });

  await Promise.all(nested.map((el) => loadBlock(el)));
}

/**
 * Pull a layout modifier class (e.g. "layout-50-50" / "full" / "half" / "third")
 * from the `cols-2` or `cols-1` field row Universal Editor emits, and apply it
 * to the columns block. The row itself is removed so it doesn't render.
 * @param {Element} block The columns block element
 */
function applyLayoutClass(block) {
  const layoutPattern = /^(layout-30-70|layout-50-50|layout-70-30|full|half|third)$/;
  [...block.children].forEach((row) => {
    const text = row.textContent.trim();
    if (layoutPattern.test(text) && row.children.length === 1
        && row.firstElementChild.children.length === 0) {
      block.classList.add(text);
      row.remove();
    }
  });
}

export default async function decorate(block) {
  applyLayoutClass(block);

  const firstRow = block.firstElementChild;
  if (firstRow) {
    const cols = [...firstRow.children];
    block.classList.add(`columns-${cols.length}-cols`);
  }

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  await decorateNestedBlocks(block);
}
