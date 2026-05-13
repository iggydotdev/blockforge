export default function decorate(block) {
  const rawStyle = block.firstElementChild?.firstElementChild?.textContent?.trim() || '';

  block.textContent = '';

  const styles = rawStyle
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const hr = document.createElement('hr');
  if (styles.length) {
    hr.classList.add(...styles);
  }

  block.appendChild(hr);
}
