/*
 * Accordion Block
 * Recreate an accordion
 * https://www.hlx.live/developer/block-collection/accordion
 */

export default function decorate(block) {
  const rows = [...block.children];
  const labelRow = rows[0];
  const bodyRow = rows[1];

  const labelCell = labelRow?.firstElementChild;
  const bodyCell = bodyRow?.firstElementChild;

  if (!labelCell || !bodyCell) return;

  const summary = document.createElement('summary');
  summary.className = 'accordion-label';
  summary.append(...labelCell.childNodes);

  const body = document.createElement('div');
  body.className = 'accordion-body';
  body.append(...bodyCell.childNodes);

  const details = document.createElement('details');
  details.append(summary, body);

  block.replaceChildren(details);
}
