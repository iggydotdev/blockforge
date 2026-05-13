export default function decorate(block) {
  let raw = block.firstElementChild?.firstElementChild?.textContent?.trim() || '';
  block.textContent = '';

  const openingTag = ['::[', '&lt;'];
  const closingTag = [']::', '&gt;'];

  if (raw) {
    openingTag.forEach((tag) => { raw = raw.replaceAll(tag, '<'); });
    closingTag.forEach((tag) => { raw = raw.replaceAll(tag, '>'); });

    // Parse into a temporary container (scripts won't execute here)
    const temp = document.createElement('div');
    temp.innerHTML = raw;

    // Move non-script nodes into the block
    [...temp.childNodes].forEach((node) => {
      if (node.nodeName !== 'SCRIPT') {
        block.appendChild(node);
      }
    });

    // Re-create each <script> programmatically so the browser executes it
    temp.querySelectorAll('script').forEach((oldScript) => {
      const newScript = document.createElement('script');
      // Copy all attributes (type, src, crossorigin, etc.)
      [...oldScript.attributes].forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      // Copy inline code
      if (oldScript.textContent) {
        newScript.textContent = oldScript.textContent;
      }
      block.appendChild(newScript);
    });
  }
}
