# Guide: How this AEM EDS + Universal Editor project works

This is a teaching guide for the repo. It explains where things live, how the
pieces fit together, and what happens at build time, at authoring time, and at
runtime in the browser.

The project is the **AEM Boilerplate with Crosswalk (xwalk)** — i.e. Edge
Delivery Services (EDS, a.k.a. "Franklin") + AEM + the Universal Editor (UE).

---

## 1. What this project is

- **Authoring**: happens in AEM, through the **Universal Editor**. Content is
  stored as structured components (text, title, image, button, cards, hero, …)
  with typed fields.
- **Delivery**: AEM renders a minimal HTML document; EDS fetches it via the
  mountpoint in [fstab.yaml](fstab.yaml) and the browser-side boilerplate
  progressively decorates it into the final DOM.
- **Editing in place**: when the page is opened inside UE, special
  `data-aue-*` attributes are injected; a small editor-support layer listens
  for change events from UE and re-runs decoration on the affected fragment
  without a full reload.

---

## 2. The 30-second mental model

```
                  ┌──────────────────────────── build time ───────────────────────────┐
                  │                                                                    │
 models/_*.json ──┤  npm run build:json (merge-json-cli)                               │
 blocks/*/_*.json │   → component-definition.json  (what UE can insert)                │
                  │   → component-models.json      (field schema per component)        │
                  │   → component-filters.json     (what children each container takes)│
                  └────────────────────────────────────────────────────────────────────┘

 ┌──── AEM (author) ────┐       ┌─── EDS delivery ───┐        ┌──── browser ────┐
 │ UE reads the 3 JSONs │──────▶│ renders HTML from  │───────▶│ scripts.js      │
 │ and stores content   │       │ authored content   │        │  decorateMain() │
 └──────────────────────┘       └────────────────────┘        │  loadBlock()    │
                                                              │  + editor-      │
                                                              │    support.js   │
                                                              └─────────────────┘
```

Three JSON files describe *what* components exist, *what fields* they have,
and *what children each container accepts* (see [§17](#17-nesting-vs-items-vs-fragments)
for why this is not the same as "nesting blocks"). Everything else is either
DOM-decoration code (blocks) or the EDS runtime.

---

## 3. Repo map

| Path | Purpose |
| --- | --- |
| [component-definition.json](component-definition.json) | **Generated.** Catalog of components UE can insert. |
| [component-models.json](component-models.json) | **Generated.** Field schemas keyed by model id. |
| [component-filters.json](component-filters.json) | **Generated.** Allowed-children rules per container. |
| [models/](models) | Source fragments that get merged into the three files above. |
| [blocks/](blocks) | One folder per block: `_<name>.json` + `<name>.js` + `<name>.css`. |
| [scripts/scripts.js](scripts/scripts.js) | Page lifecycle: eager / lazy / delayed decoration. |
| [scripts/aem.js](scripts/aem.js) | EDS core helpers: `decorateBlocks`, `loadBlock`, `createOptimizedPicture`, … |
| [scripts/editor-support.js](scripts/editor-support.js) | Hooks for UE `aue:content-*` events (re-decoration). |
| [scripts/editor-support-rte.js](scripts/editor-support-rte.js) | Groups richtext-instrumented nodes for UE. |
| [scripts/delayed.js](scripts/delayed.js) | Runs ~3 s after load (analytics, non-critical). |
| [styles/styles.css](styles/styles.css), [styles/lazy-styles.css](styles/lazy-styles.css), [styles/fonts.css](styles/fonts.css) | Global / lazy / font CSS. |
| [head.html](head.html) | Injected into `<head>` (CSP, bootstrap scripts). |
| [fstab.yaml](fstab.yaml) | Mountpoint: where EDS fetches markup from AEM. |
| [paths.json](paths.json) | Content path ↔ URL mapping. |
| [helix-query.yaml](helix-query.yaml), [helix-sitemap.yaml](helix-sitemap.yaml) | Indexing & sitemap config. |
| [tools/sidekick/config.json](tools/sidekick/config.json) | Sidekick (editor deep-link) config. |
| [package.json](package.json) | `build:json`, `lint`, dev deps. |

---

## 4. The three component JSONs (what UE reads)

These are the contract between the code in this repo and the Universal Editor.

### 4.1 `component-definition.json` — the Insert dialog

Grouped into `Default Content`, `Sections`, and `Blocks`. Each entry has an
`id`, a `title`, and an `xwalk.page` plugin pointing at a `resourceType`:

| Resource type | Used for |
| --- | --- |
| `core/franklin/components/text/v1/text` | Plain text default content |
| `core/franklin/components/title/v1/title` | Heading default content |
| `core/franklin/components/image/v1/image` | Image default content |
| `core/franklin/components/button/v1/button` | Button default content |
| `core/franklin/components/section/v1/section` | A section container |
| `core/franklin/components/block/v1/block` | A block (e.g. cards, hero, fragment) |
| `core/franklin/components/block/v1/block/item` | A nestable block item (e.g. card) |
| `core/franklin/components/columns/v1/columns` | The columns block |

The `template` inside each entry is what gets seeded when the author inserts
the component. Two keys to know:

- `template.model` → the id in `component-models.json` whose fields show up
  in the UE properties rail.
- `template.filter` → the id in `component-filters.json` that says which
  children can go inside this container.

### 4.2 `component-models.json` — field schemas

An array of `{ id, fields[] }`. Each field has `component`, `name`, `label`,
and usually a `valueType`. Field components seen in this repo:

| `component` | Renders as | Stored value |
| --- | --- | --- |
| `text` | Single-line input | Arbitrary string (use for external URLs too) |
| `richtext` | WYSIWYG HTML editor | HTML |
| `select` | Dropdown (with `options[]`) | Chosen value |
| `multiselect` | Multi-choice | Array of values |
| `reference` | **DAM asset picker** | Asset path (image/video/pdf) |
| `aem-content` | **AEM content-tree picker** | Page / fragment path inside AEM |

**`reference` vs `aem-content` vs `text`** — pick by what's being selected:

- Picking **an image / video / pdf** → `reference`.
- Picking **a page or content fragment inside AEM** → `aem-content`.
- **External URL** (arbitrary http(s)) → `text`. `aem-content` only lets
  authors pick *inside* the configured content tree (see [fstab.yaml](fstab.yaml)
  / [paths.json](paths.json)); it cannot target external sites.

Also available per field: `multi: true` (array), `value` (default),
`description` (tooltip).

### 4.3 `component-filters.json` — nesting rules

Simple list of `{ id, components[] }`. If a container's `template.filter`
points at filter id `X`, then UE will only let the author insert the
`components` listed under `X`. Examples from this repo:

```json
{ "id": "section", "components": ["text","image","button","title","hero","cards","columns","fragment"] }
{ "id": "cards",   "components": ["card"] }
{ "id": "column",  "components": ["text","image","button","title"] }
```

---

## 5. How those three JSONs are generated

**Do not edit the three root `component-*.json` files by hand** — they are
regenerated. Source lives under [models/](models) and in each block's
`_<block>.json`.

From [package.json](package.json):

```json
"build:json": "npm-run-all -p build:json:models build:json:definitions build:json:filters",
"build:json:models":      "merge-json-cli -i models/_component-models.json     -o component-models.json",
"build:json:definitions": "merge-json-cli -i models/_component-definition.json -o component-definition.json",
"build:json:filters":     "merge-json-cli -i models/_component-filters.json    -o component-filters.json"
```

The three `models/_component-*.json` files are just indexes of `...`
references. `merge-json-cli` expands each reference (including globs). For
example [models/_component-definition.json](models/_component-definition.json):

```json
{
  "groups": [
    { "title": "Default Content", "id": "default", "components": [
        { "...": "./_text.json#/definitions" },
        { "...": "./_title.json#/definitions" },
        { "...": "./_image.json#/definitions" },
        { "...": "./_button.json#/definitions" }
    ]},
    { "title": "Sections", "id": "sections", "components": [
        { "...": "./_section.json#/definitions" }
    ]},
    { "title": "Blocks",   "id": "blocks",   "components": [
        { "...": "../blocks/*/_*.json#/definitions" }
    ]}
  ]
}
```

The `../blocks/*/_*.json#/definitions` glob is how **every block auto-registers
itself** — you never touch the root file to add a block.

**Rule of thumb**: after editing anything under `models/` or any
`blocks/*/_*.json`, run:

```sh
npm run build:json
```

---

## 6. Anatomy of a `models/_<thing>.json` file

Each file can contribute up to three fragments, matching the three outputs:
`definitions`, `models`, and `filters`. The canonical small example is
[models/_section.json](models/_section.json):

```json
{
  "definitions": [ { "title": "Section", "id": "section",
    "plugins": { "xwalk": { "page": {
      "resourceType": "core/franklin/components/section/v1/section",
      "template": { "model": "section" }
    }}}
  }],
  "models": [ { "id": "section", "fields": [
    { "component": "text",        "name": "name",  "label": "Section Name" },
    { "component": "multiselect", "name": "style", "label": "Style",
      "options": [ { "name": "Highlight", "value": "highlight" } ] }
  ]}],
  "filters": [ { "id": "section", "components":
    ["text","image","button","title","hero","cards","columns","fragment"] } ]
}
```

A file can also contribute only *some* of the three sections. For example
[models/_text.json](models/_text.json) has `definitions` but no `models`,
because the text component is built-in and needs no custom fields.
[models/_page.json](models/_page.json) contributes only a `page-metadata`
model (title/description/keywords) — the metadata schema for pages.

### 6.1 The `plugins` field on a definition

`plugins` is the extension point for **renderer-/tool-specific configuration**.
The outer envelope (`id`, `title`, `plugins`) is format-agnostic; anything a
specific consumer needs goes under `plugins.<pluginName>`.

In this repo you only see one plugin: **`xwalk`** (Crosswalk — the AEM ↔ EDS
bridge). It tells AEM *how to instantiate the component* when the author
picks it from the UE Insert dialog.

```json
"plugins": {
  "xwalk": {
    "page": {
      "resourceType": "core/franklin/components/block/v1/block",
      "template": { "name": "Cards", "filter": "cards" }
    }
  }
}
```

- **`xwalk.page`** — config for inserting into a **page** surface.
- **`resourceType`** — the JCR `sling:resourceType` AEM creates (see
  [§6.2](#62-what-is-franklin--corefranklin) for the `core/franklin/…`
  meaning).
- **`template`** — seed values applied to a fresh instance:
  - `name` — the label written into the block table header (becomes
    `<div class="<name> block">` after EDS decoration).
  - `model` — id in `component-models.json` whose fields show in the rail.
  - `filter` — id in `component-filters.json` constraining children.
  - `columns`/`rows` — for the columns block only.
  - Any of the component's own fields can be prefilled here
    (e.g. `"linkType": "primary"` on a button).

Three questions the definition answers: **catalog** (id/title), **plugin**
(how AEM creates it), **seed** (what initial values it gets).

### 6.2 What is "Franklin" / `core/franklin/...`?

**Franklin** is the original codename for what Adobe now markets as
**Edge Delivery Services** / **aem.live**. Three names for one platform:

| Name | Where you see it |
| --- | --- |
| **Franklin** | Original codename; still in resource types and URLs |
| **Helix** | Earlier codename (CLI is `@adobe/helix-cli`, configs `helix-*.yaml`) |
| **Edge Delivery Services / aem.live** | Current marketing name |

The path in a `resourceType` decodes as:

```
core/franklin/components/block/v1/block
│    │        │          │     │  │
│    │        │          │     │  └─ specific component (or "block/item" for repeatable rows)
│    │        │          │     └──── version
│    │        │          └────────── component family
│    │        └───────────────────── it's a component
│    └────────────────────────────── the Franklin/EDS integration namespace
└─────────────────────────────────── ships with AEM core (not your project)
```

You don't own these resource types — AEM does. Your code lives in
`blocks/<name>/` and in the merged `component-*.json`; you pick from the
handful AEM provides and parameterize them via `template`.

### 6.3 `v1` vs `v2` — how do you know?

There's no published version matrix. You find out the same way you find out
which resource types exist at all:

1. **CRXDE on your author instance** (ground truth) —
   `https://<author-host>/crx/de/` → navigate to `/libs/core/franklin/components/`.
   Sibling folders under each component folder are the versions available on
   that specific AEM release.
2. **Upstream boilerplate** —
   [adobe/aem-boilerplate-xwalk](https://github.com/adobe/aem-boilerplate-xwalk)
   tracks the current recommended versions. Diff it to spot bumps.
3. **AEM release notes** — new component versions get called out monthly.
   [README.md](README.md) pins the minimum AEM release for this repo.
4. **`eslint-plugin-xwalk`** (already in [package.json](package.json))
   validates `resourceType` values; `npm run lint` is a cheap sanity check.

Rules of thumb:

- **Default to what the current boilerplate uses** (`v1` everywhere here).
  Don't upgrade speculatively.
- **Versions are per-component**, not global. `text/v2` existing doesn't
  imply `block/v2` exists.
- **v1 is not deprecated just because v2 ships.** AEM keeps old versions
  installed; migration is opt-in.
- **Already-authored content stays on its original version.** Changing
  `resourceType` in `component-definition.json` only affects newly inserted
  instances.
- **`template` keys can differ between versions.** If you move to `v2`,
  verify supported properties in the component's `cq:dialog` /
  `cq:editConfig` under its version folder in CRXDE.

---

## 7. Anatomy of a block — `cards` as the teaching example

A block is a folder in `blocks/` containing three files:

- [blocks/cards/_cards.json](blocks/cards/_cards.json) — the UE contract.
- [blocks/cards/cards.js](blocks/cards/cards.js) — the DOM decorator.
- [blocks/cards/cards.css](blocks/cards/cards.css) — scoped styles.

### 7.1 `_cards.json`

```json
{
  "definitions": [
    { "title": "Cards", "id": "cards", "plugins": { "xwalk": { "page": {
        "resourceType": "core/franklin/components/block/v1/block",
        "template": { "name": "Cards", "filter": "cards" } }}}},
    { "title": "Card",  "id": "card",  "plugins": { "xwalk": { "page": {
        "resourceType": "core/franklin/components/block/v1/block/item",
        "template": { "name": "Card",  "model":  "card"  } }}}}
  ],
  "models":  [ { "id": "card",  "fields": [
      { "component": "reference", "name": "image", "label": "Image" },
      { "component": "richtext",  "name": "text",  "label": "Text"  } ] } ],
  "filters": [ { "id": "cards", "components": ["card"] } ]
}
```

Notes:

- `template.name` ("Cards") is the heading that appears in the AEM block
  table — that's what EDS converts into a `<div class="cards block">`.
- `template.filter: "cards"` lets only `card` items be inserted inside.
- `template.model: "card"` tells UE which properties to show when an author
  selects a card.

### 7.2 `cards.js`

```js
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);              // preserve UE metadata
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture'))
        div.className = 'cards-card-image';
      else
        div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });
  block.replaceChildren(ul);
}
```

Key contract for a block's JS file:

- Default export is `function decorate(block)` (may be `async`).
- `block` is the `<div class="cards block">` element that EDS already
  located and class-tagged for you.
- AEM emits one child `<div>` per row of the authored block table — in this
  case, one row per card.
- You are free to restructure the DOM however you like; just pass all
  `data-aue-*` / `data-richtext-*` attributes through with
  `moveInstrumentation()` — otherwise the Universal Editor loses the mapping
  between the visible DOM and the content store and the element becomes
  un-editable.

### 7.3 `cards.css`

Nothing special — CSS is loaded automatically by `loadBlock()` before the JS
runs. Scope your selectors with `.cards` / `.cards-card-*` etc.

---

## 8. Contrast with the other blocks

- **[blocks/hero/](blocks/hero)** — defines a `hero` model
  (image / imageAlt / richtext) but no `filters`. Its
  [hero.js](blocks/hero/hero.js) is currently empty, so the block renders
  whatever markup AEM produced, styled only by
  [hero.css](blocks/hero/hero.css).
- **[blocks/columns/](blocks/columns)** — uses a different resource type
  (`core/franklin/components/columns/v1/columns`) with a `columns`/`rows`
  template. The filter allows a `column` container whose children are
  `text, image, button, title`.
- **[blocks/fcards/](blocks/fcards)** — same shape as cards but intended to
  fetch an external JSON feed via `block.dataset.url`. (See **Gotchas**.)
- **[blocks/fragment/](blocks/fragment)** — embeds another AEM page by
  content path via the `aem-content` field.

---

## 9. Naming and id rules

- Block folder name = block id = CSS class prefix (e.g. `cards`).
- `definitions[].id` must match the ids referenced by `template.model` and
  `template.filter`.
- Filter ids are matched **case-sensitively**. Double-check casing when you
  wire things up.
- If a block is supposed to be insertable inside a section, add its id to
  the `section` filter in [models/_section.json](models/_section.json).

---

## 10. Runtime pipeline

Bootstrapped by [head.html](head.html), which injects the CSP meta tag and:

```html
<script nonce="aem" src="/scripts/aem.js"     type="module"></script>
<script nonce="aem" src="/scripts/scripts.js" type="module"></script>
<link   rel="stylesheet" href="/styles/styles.css"/>
```

[scripts/scripts.js](scripts/scripts.js) orchestrates page load in three
phases:

1. **Eager** — `loadEager()`:
   - `decorateTemplateAndTheme()`
   - `decorateMain(main)` which runs, in order:
     `decorateButtons`, `decorateIcons`, `buildAutoBlocks`,
     `decorateSections`, `decorateBlocks`.
   - Loads the first section + waits for the first image (LCP).
2. **Lazy** — `loadLazy()`:
   - Loads the header + remaining sections + footer.
   - Loads `styles/lazy-styles.css` and fonts.
3. **Delayed** — 3 s later, dynamically imports
   [scripts/delayed.js](scripts/delayed.js) for non-critical work.

The bit that ties each block folder to its element:

- `decorateBlocks` (in [scripts/aem.js](scripts/aem.js)) finds every
  `<div class="<name>">` block, adds the `block` class, reads the name, and
  marks it as loadable.
- `loadBlock` dynamically imports `blocks/<name>/<name>.js` and
  `blocks/<name>/<name>.css`, then calls the module's default export with
  the block element.

That dynamic import is why you never register a block anywhere — the folder
name **is** the registration.

---

## 11. Universal Editor integration

When the page is opened inside UE, the UE iframe listens for DOM changes and
fires `aue:content-*` events on elements carrying `data-aue-resource`.
[scripts/editor-support.js](scripts/editor-support.js) attaches listeners for
six events:

```
aue:content-patch   aue:content-update   aue:content-add
aue:content-move    aue:content-remove   aue:content-copy
```

Flow inside `applyChanges(event)`:

1. Extract the changed resource id from the event.
2. Read the new HTML fragment from `event.detail.response.updates[0].content`.
3. Run it through `DOMPurify.sanitize` (loaded lazily from
   [scripts/dompurify.min.js](scripts/dompurify.min.js)).
4. Find the matching `[data-aue-resource="…"]` element in the live DOM.
5. Insert the new element next to it, re-run the right subset of decorators
   (`decorateMain` / `decorateBlock` / `decorateSections`), remove the old
   one, and unhide the new one.
6. If nothing matches, fall back to a full `location.reload()`.

[scripts/editor-support-rte.js](scripts/editor-support-rte.js) does a
complementary job: it groups inline nodes that carry `data-richtext-*` into
wrapper divs so UE can target them. A `MutationObserver` re-runs it whenever
new `data-richtext-prop` attributes appear (e.g. under experimentation).

The glue in [scripts/scripts.js](scripts/scripts.js) is the tiny helper
`moveInstrumentation(from, to)`, which copies only the attributes starting
with `data-aue-` or `data-richtext-`. Call it whenever you replace an
element in a block's `decorate()` function.

---

## 12. AEM / delivery wiring

- [fstab.yaml](fstab.yaml) — mounts `/` on the AEM author endpoint
  `/bin/franklin.delivery/.../main`. This is how `aem up` (and the
  `*.aem.page` / `*.aem.live` hosts) fetch rendered markup.
- [paths.json](paths.json) — maps `/content/aem-boilerplate/` → `/`.
- [helix-query.yaml](helix-query.yaml), [helix-sitemap.yaml](helix-sitemap.yaml)
  — configure the indexer and sitemap.
- [tools/sidekick/config.json](tools/sidekick/config.json) — the "AEM Editor"
  deep-link used by the Sidekick extension:
  `{{contentSourceUrl}}{{pathname}}?cmd=open`.

---

## 13. Common workflows (cheat sheet)

### Add a new block

1. Create `blocks/<name>/` with:
   - `_<name>.json` — at minimum a `definitions` entry; add `models` if you
     need custom fields and `filters` if it's a container.
   - `<name>.js` — `export default function decorate(block) { … }`.
   - `<name>.css` — styles scoped with `.<name>`.
2. Run `npm run build:json`.
3. If the block should be insertable inside sections, add its id to the
   `section` filter in [models/_section.json](models/_section.json) and
   re-run `build:json`.

### Add a field to an existing block

1. Edit the `models[]` entry in `blocks/<name>/_<name>.json` (or the
   relevant `models/_<thing>.json`).
2. Run `npm run build:json`.
3. Consume the new field in `<name>.js` / `<name>.css` as needed.

### Change allowed children

Edit the appropriate `filters[]` entry (either in `models/_section.json`,
`models/_component-filters.json`, or a block's `_<name>.json`) and re-run
`npm run build:json`.

### Verify UE editability

After restructuring the DOM in a block's `decorate()`, open the page in UE
and confirm the affected elements still show the selection chrome. If they
do not, you are almost certainly missing a `moveInstrumentation()` call.

---

## 14. Gotchas

- **Never edit the root `component-*.json` files directly.** They are
  regenerated by `npm run build:json` and your changes will be lost.
- **Always re-run `npm run build:json`** after touching anything under
  `models/` or any `blocks/*/_*.json`.
- **`moveInstrumentation()` is not optional.** Forgetting it silently
  breaks editability for any element you replace.
- **Casing matters.** In this repo, the `fcards` filter id in
  [component-filters.json](component-filters.json) is spelled `fCards`
  inside [blocks/fcards/_fcards.json](blocks/fcards/_fcards.json) but
  `fcards` in the block's `template.filter`. That mismatch will prevent
  the `URL` item from being insertable — worth cleaning up.
- **[blocks/hero/hero.js](blocks/hero/hero.js) is empty.** The hero block
  relies entirely on AEM's default markup + CSS. If you want custom DOM,
  add a `decorate()` function.
- **[blocks/fcards/fcards.js](blocks/fcards/fcards.js) is not wired
  correctly.** `fetchCards(block.dataset.url)` returns a Promise; the
  `?? []` fallback doesn't apply to a Promise, and `forEach` is being
  called on the Promise itself. The block needs to be made `async`,
  `await` the fetch, and read the URL from an actual field (see
  [§18](#18-dynamic-content-fetching-external-data-like-fcards)).

---

## 15. Further reading

From [README.md](README.md):

- [aem.live — developer docs](https://www.aem.live/docs/) —
  [Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project),
  [Markup, Sections, Blocks and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks),
  [Keeping it 100](https://www.aem.live/developer/keeping-it-100).
- [Experience League — WYSIWYG authoring with Universal Editor](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/authoring),
  [Creating Blocks](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/create-block),
  [Content Modeling](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/content-modeling).

**Caveat on docs:** there is **no public canonical list** of every
`core/franklin/...` resource type with its supported `template` keys.
Authoritative sources of truth are (a) the upstream boilerplate, (b) CRXDE
under `/libs/core/franklin/components/` on your author instance, and (c) the
`adobe-rnd/eslint-plugin-xwalk` rules already pulled in via
[package.json](package.json).

---

## 16. Worked example: adding a `quote` block

Goal: a block that renders a blockquote with an author line.

**1. `blocks/quote/_quote.json`**

```json
{
  "definitions": [
    { "title": "Quote", "id": "quote", "plugins": { "xwalk": { "page": {
        "resourceType": "core/franklin/components/block/v1/block",
        "template": { "name": "Quote", "model": "quote" } }}}}
  ],
  "models": [
    { "id": "quote", "fields": [
      { "component": "richtext", "name": "text",   "label": "Quote"  },
      { "component": "text",     "name": "author", "label": "Author" }
    ]}
  ],
  "filters": []
}
```

**2. `blocks/quote/quote.js`**

```js
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const [textRow, authorRow] = [...block.children];
  const figure = document.createElement('figure');
  const bq = document.createElement('blockquote');
  const cap = document.createElement('figcaption');

  moveInstrumentation(textRow, bq);
  while (textRow.firstElementChild) bq.append(textRow.firstElementChild);

  moveInstrumentation(authorRow, cap);
  cap.textContent = authorRow.textContent.trim();

  figure.append(bq, cap);
  block.replaceChildren(figure);
}
```

**3. `blocks/quote/quote.css`**

```css
.quote blockquote { font-size: 1.25rem; font-style: italic; }
.quote figcaption { margin-top: .5rem; opacity: .7; }
```

**4. Register it as insertable in sections**

Edit [models/_section.json](models/_section.json) and add `"quote"` to the
`section` filter's `components` array.

**5. Rebuild**

```sh
npm run build:json
```

The new block is now insertable in sections and fully editable in UE.

---

## 17. Nesting vs items vs fragments

A common misconception: "can I put a block inside another block?"

**No — you cannot nest blocks inside other blocks in EDS + UE.** What this
repo supports is three related (but distinct) things:

### 17.1 Block **items** (repeatable rows)

A block can declare a child schema using the `block/item` resource type —
that's what `cards` does with `card`. The `card`:

- is **not** a block (no `blocks/card/` folder, no `card.js`, no `card.css`);
- is only an **item schema** that exists as a row inside its parent;
- is rendered into DOM by the parent block's `decorate()`.

The parent's `template.filter` gates which item ids it accepts
(`cards` → `[card]`).

### 17.2 The `columns` container

`columns` uses a different resource type (`.../columns/v1/columns`). Its
filter lets each column contain **default content** (`text, image, button,
title`) — still not other blocks.

### 17.3 Fragment references

The `fragment` block *references* another AEM page via an `aem-content`
field. At render time the referenced page's content is inlined, which
visually can look like nested blocks — but it's an include, not nesting
in the author's page tree. The referenced page is independently authored.

### 17.4 What filters in this repo actually permit

| Container | Allowed children | Kind |
| --- | --- | --- |
| `main` | `section` | Sections |
| `section` | `text, image, button, title, hero, cards, columns, fragment` | Default content + blocks |
| `cards` | `card` | Item only |
| `fCards` | `URL` | Item only (note casing bug) |
| `columns` | `column` | Item only |
| `column` | `text, image, button, title` | Default content only |

No filter allows a block inside another block.

---

## 18. Dynamic content: fetching external data (like `fcards`)

Rendering cards from an external API needs a few things the existing
`fcards` block gets wrong. The pattern below is the correct shape.

### 18.1 Model: one URL field on the block itself

Use a `text` field (not `aem-content` — that only picks content **inside**
AEM, not external URLs):

```json
{
  "definitions": [
    { "title": "fCards", "id": "fcards", "plugins": { "xwalk": { "page": {
        "resourceType": "core/franklin/components/block/v1/block",
        "template": { "name": "fCards", "model": "fcards" } }}}}
  ],
  "models": [
    { "id": "fcards", "fields": [
      { "component": "text", "valueType": "string", "name": "url",
        "label": "Feed URL",
        "description": "Absolute URL to a JSON feed (must be CORS-accessible)." }
    ]}
  ],
  "filters": []
}
```

Then `npm run build:json`.

### 18.2 Reading the field at runtime

Xwalk-authored block fields are **not** automatically exposed as `data-*`
attributes — they are emitted as key/value rows inside the block element.
Use `readBlockConfig` from [scripts/aem.js](scripts/aem.js) to parse them.

### 18.3 Async decorator

`loadBlock` awaits each block's default export, so making `decorate`
`async` is fine:

```js
import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';

async function fetchCards(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fcards: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data ?? json;   // adjust to the feed shape
}

export default async function decorate(block) {
  const { url } = readBlockConfig(block);
  block.textContent = '';                      // clear authored rows
  if (!url) return;

  let items = [];
  try { items = await fetchCards(url); }
  catch (e) { console.error(e); return; }

  const ul = document.createElement('ul');
  items.forEach((item) => {
    const li = document.createElement('li');
    if (item.image) {
      const wrap = document.createElement('div');
      wrap.className = 'fcards-card-image';
      wrap.append(createOptimizedPicture(item.image, item.title ?? '', false, [{ width: '750' }]));
      li.append(wrap);
    }
    const body = document.createElement('div');
    body.className = 'fcards-card-body';
    if (item.title)       { const h = document.createElement('h3'); h.textContent = item.title;       body.append(h); }
    if (item.description) { const p = document.createElement('p'); p.textContent = item.description; body.append(p); }
    if (item.path)        { const a = document.createElement('a'); a.href = item.path; a.textContent = 'Read more'; body.append(a); }
    li.append(body);
    ul.append(li);
  });
  block.append(ul);
}
```

Key points:

- `block.textContent = ''` runs **after** reading the URL, so the outer
  block's `data-aue-*` attributes stay intact — the block itself remains
  editable in UE.
- Dynamically rendered cards are **not** editable in UE (they're not in
  AEM). That is usually the intent.
- If the author changes the URL, UE's re-decoration pipeline
  ([scripts/editor-support.js](scripts/editor-support.js)) will re-invoke
  `decorate()` with the new value automatically — no extra wiring needed.

### 18.4 Non-schema concerns

- **CORS** — the target server must send `Access-Control-Allow-Origin` for
  your EDS origin, or you must proxy through AEM / an edge worker.
- **Mixed content** — HTTPS page → HTTPS feed only.
- **Perf** — this runs in the lazy phase. If the block is above the fold,
  consider caching in `sessionStorage` or serving from a same-origin
  query-index.
- **Sanitization** — if any feed field contains HTML you want to render,
  run it through DOMPurify ([scripts/dompurify.min.js](scripts/dompurify.min.js)).
  Otherwise stick to `textContent`.
- **Basic validation** — `text` fields aren't URL-validated by UE. A defensive
  check in the decorator is cheap:
  ```js
  let feed;
  try { feed = new URL(url); } catch { return; }
  if (!/^https?:$/.test(feed.protocol)) return;
  ```

---

## 19. Sharing models across components (and when not to)

Models are just named field schemas — **any number of definitions can
reference the same model** via `template.model`. But sharing a model is
usually a smell.

### 19.1 It's technically fine

You can define both a `card` item (inside `cards`) and a standalone `Card`
block that both use `model: "card"`. Ids must be unique across definitions
(e.g. `card` and `card-block`), resource types differ
(`.../block/v1/block/item` vs `.../block/v1/block`), and each still needs
its own decorator since the DOM shapes differ.

### 19.2 Why it's rarely worth it

- **A `cards` block with one card already renders a single card.** No extra
  code, identical DOM.
- **Two code paths to maintain.** Any change to card fields, markup, or CSS
  now lives in two places.
- **Authoring confusion.** Two near-identical Insert-dialog entries
  ("Card" vs "Cards") are a classic source of mistakes.
- **No content reuse.** A standalone card and a card inside cards are
  independent nodes in AEM — they don't share content.

### 19.3 When a standalone block *is* the right call

- The pattern has **its own fields** that don't map to existing components
  (e.g. a feed source, a max-items count).
- The DOM needs to be a **single semantic unit** beyond what CSS can do
  (an `aria-labelledby`-bound `<section>`, a carousel owning its subtree).
- It needs to be insertable somewhere the parent container isn't allowed
  (filters gate insertion).
- The layout / fields are genuinely **different** from the item variant —
  in which case give it its **own** model too. Don't share.

### 19.4 Rule of thumb

**One model → one component.** Sharing is fine in principle but usually
signals you haven't decided whether the two components are the same thing
or different things.

---

## 20. Pattern: "section with title, button, and cards"

Common design: a titled row with a "view all" button on the right, followed
by a grid of cards. Some sections use authored cards, others fetch from an
API.

### 20.1 Compose — don't build a monolith

Build this from what already exists: **section + Title + Button + Cards (or
fCards)**. A single "TitledCards" block would reinvent the title/button
models and lose reusability.

Authoring structure:

```
Section (style: "tile-row")
├── Title     (h2, "Our products")
├── Button    (linkType: secondary, text: "view all")
└── Cards     (or fCards for API-driven)
    ├── Card
    └── …
```

Nothing new in JS. All four components already exist in the repo.

### 20.2 Layout via a section style

The "title left, button right" header is pure CSS. Add a style variant in
[models/_section.json](models/_section.json) so authors opt in per section:

```json
{ "name": "Tile Row", "value": "tile-row" }
```

`npm run build:json`, then in [styles/styles.css](styles/styles.css):

```css
.section.tile-row > .default-content-wrapper:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.section.tile-row > .default-content-wrapper:first-child h2 { margin: 0; }
```

EDS already wraps consecutive default content into a
`.default-content-wrapper` and each block into `.<name>-wrapper`, so the
title + button land in one wrapper and the cards in the next — no markup
changes required.

### 20.3 Authored vs API-fed — two blocks, one look

- `cards` for authored content.
- `fcards` for API-driven (see [§18](#18-dynamic-content-fetching-external-data-like-fcards)).

Give both the same class hooks (e.g. a shared `.card-tile` applied by each
decorator, or parallel `.cards-card-*` / `.fcards-card-*` selectors sharing
the same rules) so the grid is visually identical regardless of source.

### 20.4 When to actually build a block

Reach for a dedicated block only if **at least one** applies:

- The pattern has fields that don't belong on title / button / cards.
- The subtree needs to be a single scripted unit (e.g. a carousel).
- Authors find composing the three parts genuinely confusing (rare).

Otherwise: compose.
