const fetchCards = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch cards data: ${response.statusText}`);
  }
  return response.json();
};

export default async function decorate(block) {
  // One-line extraction. Works for any number of fields.
  const url = block.querySelector('a')?.href || block.textContent.trim();
  block.dataset.url = url;

  // Hide the authored rows instead of wiping them — keeps UE happy.
  [...block.children].forEach((row) => { row.hidden = true; row.innerHTML = ''; });

  if (!block.dataset.url) return;

  /* change to ul, li */
  const ul = document.createElement('ul');

  const data = await fetchCards(block.dataset.url) ?? [];
  const items = Array.isArray(data) ? data : (data.products ?? data.results ?? data.meals ?? []);

  items.forEach((item) => {
    const li = document.createElement('li');

    const imgWrap = document.createElement('div');
    imgWrap.className = 'fcards-card-image';
    const img = document.createElement('img');
    img.src = item.image ?? item.thumbnail ?? '';
    img.alt = item.title ?? item.name ?? '';
    imgWrap.append(img);

    const body = document.createElement('div');
    body.className = 'fcards-card-body';
    body.innerHTML = `<h3>${item.title ?? item.name ?? ''}</h3><p>${item.description ?? ''}</p>`;

    li.append(imgWrap, body);
    ul.append(li);
  });

  block.append(ul);
}
