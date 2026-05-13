import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'accordion';
    moveInstrumentation(row, li);

    const rows = [...row.children];
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

    li.replaceChildren(details);

    ul.append(li);
  });
  block.replaceChildren(ul);
}
