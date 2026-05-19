# Content Modeling for Universal Editor

This resource covers content modeling patterns and best practices specific to **Universal Editor** projects in AEM as a Cloud Service. Universal Editor uses a component-based authoring approach that differs significantly from document-based authoring (Google Docs/SharePoint).

## Key Differences from Document Authoring

| Aspect | Document Authoring | Universal Editor |
|--------|-------------------|------------------|
| **Authoring Interface** | Tables in docs | Form fields in UI |
| **Content Model** | Inferred from table structure | Explicit JSON configuration |
| **DOM Structure** | One row with multiple cells | One row per field |
| **Configuration Location** | Global or inferred | Block-level `_blockname.json` |
| **Author Experience** | Edit in-context markdown | Visual component editor |

## Component Model Files

### Block-Level Configuration

Each Universal Editor block requires a `_blockname.json` file in the block directory containing:

1. **definitions**: Component metadata (id, title, plugins, resource type)
2. **models**: Field definitions (what authors can edit)

**File location:**
```
blocks/hero-banner/
  ├── hero-banner.js
  ├── hero-banner.css
  ├── _hero-banner.json    ← Component model
  └── README.md
```

**Template structure:**

```json
{
  "definitions": [{
    "title": "Block Display Name",
    "id": "block-id",
    "plugins": {
      "xwalk": {
        "page": {
          "resourceType": "core/franklin/components/block/v1/block",
          "template": {
            "name": "Block Name",
            "model": "block-model-id"
          }
        }
      }
    }
  }],
  "models": [{
    "id": "block-model-id",
    "fields": [
      // Field definitions here
    ]
  }],
  "filters": []
}
```

> **Note:** Even simple standalone blocks should include an empty `filters: []` array for consistency and future extensibility. The `filters` array is only populated for container blocks or when you need to restrict which child components can be authored within a block.

### Field Components

Universal Editor provides several field component types:

| Component | Purpose | Example Use |
|-----------|---------|-------------|
| `text-input` | Single-line text | Titles, labels, short descriptions |
| `text-area` | Multi-line plain text | Longer descriptions without formatting |
| `richtext` | HTML content | Descriptions with formatting, paragraphs, links |
| `reference` | Asset or content reference | Images, documents, content fragments |
| `select` | Single choice dropdown | Variants, types, options |
| `multiselect` | Multiple choice | Tags, categories, styles |
| `boolean` | Toggle/checkbox | Enable/disable features |
| `number` | Numeric input | Counts, limits, sizes |
| `date` | Date picker | Event dates, publication dates |

**Field definition template:**

```json
{
  "component": "text-input",
  "valueType": "string",
  "name": "fieldName",
  "label": "Field Label",
  "description": "Optional help text",
  "required": false,
  "multi": false
}
```

## Row-Per-Field Structure

**CRITICAL CONCEPT:** Each field in your model creates a **separate row** in the block's DOM.

### Simple Block Example

**Model with 3 fields:**

```json
{
  "id": "hero",
  "fields": [
    {
      "component": "reference",
      "name": "image",
      "label": "Image"
    },
    {
      "component": "text-input",
      "name": "imageAlt",
      "label": "Alt Text"
    },
    {
      "component": "text-area",
      "name": "text",
      "label": "Text"
    }
  ]
}
```

**Generates this DOM:**

```html
<div class="hero">
  <div><div><picture><img alt="..."></picture></div></div>  <!-- Row 0: image -->
  <div><div><h1>Welcome to AEM</h1></div></div>             <!-- Row 1: text -->
</div>
```

**Note:** `imageAlt` field doesn't create a visible row—it's embedded as the img alt attribute.

### Field Count vs. Row Count

Some fields are **embedded as attributes** and don't create visible rows:

- Fields ending with `Alt` → img alt attribute
- Fields ending with `Title` → link title attribute
- Fields ending with `Text` → link text content
- Fields ending with `Type` → controls semantic element or styling

**Example:**

| Model Fields | Visible Rows | Notes |
|--------------|--------------|-------|
| `image`, `imageAlt`, `title` | 2 rows | imageAlt embedded in img tag |
| `link`, `linkText`, `linkTitle` | 1 row | linkText and linkTitle embedded in anchor tag |
| `heading`, `headingType` | 1 row | headingType controls h1-h6 element type |

## Field Naming Conventions

### Field Collapse Patterns

Field collapse combines multiple fields into a single semantic element using **suffix-based naming**:

#### Alt Suffix (Image Alt Text)

**Pattern:** `{fieldName}` + `{fieldName}Alt`

```json
{
  "fields": [
    {
      "component": "reference",
      "name": "backgroundImage",
      "label": "Background"
    },
    {
      "component": "text-input",
      "name": "backgroundImageAlt",
      "label": "Alt Text"
    }
  ]
}
```

**Result:** `<img src="..." alt="{backgroundImageAlt value}">`

#### Text Suffix (Link Text)

**Pattern:** `{fieldName}` + `{fieldName}Text`

```json
{
  "fields": [
    {
      "component": "aem-content",
      "name": "cta",
      "label": "Call to Action Link"
    },
    {
      "component": "text-input",
      "name": "ctaText",
      "label": "Button Text"
    }
  ]
}
```

**Result:** `<a href="{cta value}">{ctaText value}</a>`

#### Title Suffix (Link Title Attribute)

**Pattern:** `{fieldName}` + `{fieldName}Title`

```json
{
  "fields": [
    {
      "component": "aem-content",
      "name": "link"
    },
    {
      "component": "text-input",
      "name": "linkTitle",
      "label": "Title (Tooltip)"
    },
    {
      "component": "text-input",
      "name": "linkText",
      "label": "Link Text"
    }
  ]
}
```

**Result:** `<a href="{link}" title="{linkTitle}">{linkText}</a>`

#### Type Suffix (Element Type)

**Pattern:** `{fieldName}` + `{fieldName}Type`

**For headings:**

```json
{
  "fields": [
    {
      "component": "text-input",
      "name": "heading",
      "label": "Heading"
    },
    {
      "component": "select",
      "name": "headingType",
      "label": "Heading Level",
      "options": [
        {"name": "H1", "value": "h1"},
        {"name": "H2", "value": "h2"},
        {"name": "H3", "value": "h3"}
      ]
    }
  ]
}
```

**Result:** `<h2>{heading value}</h2>` (if headingType is "h2")

**For buttons/links:**

```json
{
  "fields": [
    {
      "component": "aem-content",
      "name": "button"
    },
    {
      "component": "text-input",
      "name": "buttonText",
      "label": "Text"
    },
    {
      "component": "select",
      "name": "buttonType",
      "label": "Style",
      "options": [
        {"name": "Primary", "value": "primary"},
        {"name": "Secondary", "value": "secondary"}
      ]
    }
  ]
}
```

**Result:** `<a href="{button}" class="button primary">{buttonText}</a>`

### Element Grouping with Underscores

Element grouping combines multiple fields into a **single cell** using underscore naming: `{groupName}_{fieldName}`

**When to use:**
- Multiple fields should be combined into one semantic unit
- Reduces row count for complex blocks
- Groups related content visually in the DOM

**Example: Grouping CTA fields**

```json
{
  "fields": [
    {
      "component": "text-input",
      "name": "title",
      "label": "Title"
    },
    {
      "component": "aem-content",
      "name": "cta_link",
      "label": "CTA Link"
    },
    {
      "component": "text-input",
      "name": "cta_text",
      "label": "CTA Text"
    },
    {
      "component": "select",
      "name": "cta_type",
      "label": "CTA Style",
      "options": [
        {"name": "Primary", "value": "primary"},
        {"name": "Secondary", "value": "secondary"}
      ]
    }
  ]
}
```

**Generates:**

```html
<div class="block">
  <div><div>Title Text</div></div>                        <!-- Row 0: title -->
  <div><div>                                              <!-- Row 1: cta group -->
    <p><a href="/page" class="button primary">Click Here</a></p>
  </div></div>
</div>
```

**Without grouping:** Would create 3 separate rows (cta_link, cta_text, cta_type)
**With grouping:** Creates 1 row containing the combined CTA

### Multiple Groups in One Block

You can use multiple groups in the same model:

```json
{
  "fields": [
    {
      "component": "text-input",
      "name": "content_title",
      "label": "Title"
    },
    {
      "component": "richtext",
      "name": "content_description",
      "label": "Description"
    },
    {
      "component": "aem-content",
      "name": "primaryCta_link",
      "label": "Primary CTA"
    },
    {
      "component": "text-input",
      "name": "primaryCta_text",
      "label": "Primary CTA Text"
    },
    {
      "component": "aem-content",
      "name": "secondaryCta_link",
      "label": "Secondary CTA"
    },
    {
      "component": "text-input",
      "name": "secondaryCta_text",
      "label": "Secondary CTA Text"
    }
  ]
}
```

**Generates 3 rows:**
1. Row 0: content group (title + description)
2. Row 1: primaryCta group (link + text)
3. Row 2: secondaryCta group (link + text)

## Block Options with Element Grouping

Block options (variants/classes) can also use element grouping:

```json
{
  "fields": [
    {
      "component": "select",
      "name": "classes",
      "label": "Style Variant",
      "options": [
        {"name": "Default", "value": ""},
        {"name": "Dark", "value": "dark"}
      ]
    },
    {
      "component": "boolean",
      "name": "classes_fullwidth",
      "label": "Full Width"
    },
    {
      "component": "select",
      "name": "classes_alignment",
      "label": "Text Alignment",
      "options": [
        {"name": "Left", "value": "left"},
        {"name": "Center", "value": "center"},
        {"name": "Right", "value": "right"}
      ]
    }
  ]
}
```

**Result:** `<div class="block dark fullwidth center">`

- `classes` value: "dark"
- `classes_fullwidth` (boolean true): "fullwidth"
- `classes_alignment` value: "center"

## Multi-Fields and Composite Multi-Fields

Multi-fields allow authors to create **lists of items** within a block.

### Simple Multi-Fields

**Single value repeated:**

```json
{
  "component": "text-input",
  "name": "keywords",
  "label": "Keywords",
  "multi": true
}
```

**Generates:**

```html
<ul>
  <li>JavaScript</li>
  <li>AEM</li>
  <li>Edge Delivery</li>
</ul>
```

**With links:**

```json
{
  "component": "aem-content",
  "name": "relatedLinks",
  "label": "Related Links",
  "multi": true
}
```

**Generates:**

```html
<ul>
  <li><a href="/page1">https://example.com/page1</a></li>
  <li><a href="/page2">https://example.com/page2</a></li>
</ul>
```

### Composite Multi-Fields (Containers)

**Multiple fields repeated as a group:**

```json
{
  "component": "container",
  "name": "cards",
  "label": "Cards",
  "multi": true,
  "fields": [
    {
      "component": "reference",
      "name": "image",
      "label": "Card Image"
    },
    {
      "component": "text-input",
      "name": "imageAlt",
      "label": "Alt Text"
    },
    {
      "component": "text-input",
      "name": "title",
      "label": "Card Title"
    },
    {
      "component": "richtext",
      "name": "description",
      "label": "Description"
    }
  ]
}
```

**Generates:**

```html
<ul>
  <li>
    <picture><img src="/img1.jpg" alt="First card" /></picture>
    <h3>Card 1</h3>
    <p>Description for card 1</p>
  </li>
  <li>
    <picture><img src="/img2.jpg" alt="Second card" /></picture>
    <h3>Card 2</h3>
    <p>Description for card 2</p>
  </li>
</ul>
```

### Multi-Field Rendering Rules

**Single semantic elements → `<ul>` list:**
- Plain text items
- Links only
- Images only

**Multiple semantic elements → `<hr>` separated:**
- Items with paragraphs + links
- Items with mixed content

**Example with complex items:**

```html
<hr>
<p>First paragraph</p>
<p><a href="/link1">Link 1</a></p>
<hr>
<p>Second paragraph</p>
<p><a href="/link2">Link 2</a></p>
<hr>
```

## Type Inference

Universal Editor automatically infers semantic meaning from field values:

| Value Type | Inferred As | Rendered HTML |
|------------|-------------|---------------|
| Image asset reference | Picture | `<picture><img src="..."></picture>` |
| Content reference (non-image) | Link | `<a href="...">URL</a>` |
| URL string (http/https) | Link | `<a href="...">URL</a>` |
| Richtext starting with block element | Rich HTML | `<p>...</p>`, `<h1>...</h1>`, etc. |
| Plain text | Text | Plain text content |
| Array of values | Comma list | "value1, value2, value3" |

**Implications for decoration code:**

Your JavaScript doesn't need to convert references to images or links—Universal Editor does this automatically. You only need to:
1. Extract elements from the correct rows
2. Convert plain text to semantic HTML where needed (H1, H2)
3. Restructure/style the final output

## Container Blocks

Container blocks allow **nested items** within a block:

```json
{
  "id": "accordion",
  "fields": [
    {
      "component": "text-input",
      "name": "title",
      "label": "Accordion Title"
    }
  ]
}
```

**With filter to allow item children:**

```json
{
  "id": "accordion",
  "filters": [{
    "id": "accordion",
    "components": ["accordion-item"]
  }]
}
```

**Accordion item model:**

```json
{
  "id": "accordion-item",
  "fields": [
    {
      "component": "text-input",
      "name": "heading",
      "label": "Item Heading"
    },
    {
      "component": "richtext",
      "name": "content",
      "label": "Item Content"
    }
  ]
}
```

**Generates:**

```html
<div class="accordion">
  <div><div>Accordion Title</div></div>
  <div>
    <div>
      <picture><img src="..."></picture>
    </div>
    <div>
      <a href="...">Link</a>
    </div>
  </div>
  <div>
    <div>
      <h3>Item 1</h3>
      <p>Content for item 1</p>
    </div>
  </div>
  <div>
    <div>
      <h3>Item 2</h3>
      <p>Content for item 2</p>
    </div>
  </div>
</div>
```

## Key-Value Blocks

Some blocks need configuration data rather than content:

```json
{
  "id": "featured-articles",
  "key-value": true,
  "fields": [
    {
      "component": "aem-content",
      "name": "source",
      "label": "Article Source"
    },
    {
      "component": "text-input",
      "name": "keywords",
      "label": "Keywords"
    },
    {
      "component": "number",
      "name": "limit",
      "label": "Max Articles"
    }
  ]
}
```

**Generates:**

```html
<div class="featured-articles">
  <div>
    <div>source</div>
    <div><a href="/articles.json">/articles.json</a></div>
  </div>
  <div>
    <div>keywords</div>
    <div>JavaScript,AEM</div>
  </div>
  <div>
    <div>limit</div>
    <div>10</div>
  </div>
</div>
```

## Registering Blocks in Sections

After creating a new block component model, you must register it in `models/_section.json` to make it available for authors to add to page sections.

### Section Filters

The `_section.json` file defines what components are allowed within page sections using a `filters` array:

```json
{
  "definitions": [
    {
      "title": "Section",
      "id": "section",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/section/v1/section",
            "template": {
              "model": "section"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "section",
      "fields": [
        {
          "component": "text",
          "name": "name",
          "label": "Section Name"
        },
        {
          "component": "multiselect",
          "name": "style",
          "label": "Style",
          "options": [...]
        }
      ]
    }
  ],
  "filters": [
    {
      "id": "section",
      "components": [
        "text",
        "image",
        "button",
        "title",
        "columns",
        "hero",      // ← Block IDs registered here
        "embed"      // ← Add new block IDs to this array
      ]
    }
  ]
}
```

### Adding a New Block to Sections

**Step 1:** Identify your block ID from `_blockname.json`:

```json
{
  "definitions": [{
    "title": "My New Block",
    "id": "my-new-block",  // ← This is the block ID
    ...
  }]
}
```

**Step 2:** Add the block ID to `models/_section.json`:

```json
"filters": [
  {
    "id": "section",
    "components": [
      "text",
      "image",
      "button",
      "title",
      "columns",
      "hero",
      "embed",
      "my-new-block"  // ← Add your block ID here
    ]
  }
]
```

### When to Register

**Always register when:**
- Creating a new block that authors should be able to add to pages
- The block is intended for general content authoring
- The block is complete and ready for author use

**Skip registration when:**
- Creating auto-blocks that are automatically inserted by code
- Creating deprecated blocks that should no longer be used
- Creating special-purpose blocks used only in specific contexts (not general page sections)

### Testing Registration

After registering a block:

1. Open the Universal Editor
2. Create or edit a page
3. Click "Add Component" in a section
4. Your block should appear in the component picker
5. If it doesn't appear, verify:
   - Block ID in `_section.json` matches `_blockname.json`
   - No typos in the block ID
   - The block's `_blockname.json` file is valid JSON

## Best Practices

### 1. Minimize Field Count

**Guideline:** Aim for 3-6 fields per block model.

**Why:**
- Easier for authors to understand and use
- Fewer rows = simpler decoration code
- Better performance

**Techniques:**
- Use richtext for description + CTAs combined
- Use element grouping to combine related fields
- Use multi-fields for repeating items instead of separate fields

### 2. Use Semantic Field Names

**Good:**
- `title`, `subtitle`, `description`
- `backgroundImage`, `backgroundImageAlt`
- `primaryCta_link`, `primaryCta_text`

**Bad:**
- `field1`, `field2`, `field3`
- `text`, `text2`, `text3`
- `image1`, `image2`

### 3. Leverage Field Collapse

**Instead of separate visible fields:**
```json
{
  "fields": [
    {"name": "image"},
    {"name": "alt"},  // ❌ Creates extra row
    {"name": "title"}
  ]
}
```

**Use field collapse:**
```json
{
  "fields": [
    {"name": "image"},
    {"name": "imageAlt"},  // ✅ Embedded in img tag
    {"name": "title"}
  ]
}
```

### 4. Group Related Content

**Instead of many separate rows:**
```json
{
  "fields": [
    {"name": "ctaLink"},
    {"name": "ctaText"},
    {"name": "ctaType"}
  ]
}
```

**Use element grouping:**
```json
{
  "fields": [
    {"name": "cta_link"},     // All in
    {"name": "cta_text"},     // one
    {"name": "cta_type"}      // row
  ]
}
```

### 5. Choose Appropriate Field Types

**Text Input** - Short, single-line text (titles, labels)
**Text Area** - Longer plain text without formatting
**Richtext** - Content with formatting, paragraphs, links
**Reference** - Images, documents, content fragments

**Example:**

```json
{
  "fields": [
    {
      "component": "text-input",      // ✅ Short title
      "name": "title",
      "label": "Title"
    },
    {
      "component": "text-input",      // ✅ Short subtitle
      "name": "subtitle",
      "label": "Subtitle"
    },
    {
      "component": "richtext",        // ✅ Rich description with links
      "name": "description",
      "label": "Description"
    }
  ]
}
```

### 6. Document Your Models

Always include clear labels and descriptions:

```json
{
  "component": "reference",
  "name": "backgroundImage",
  "label": "Background Image",
  "description": "Recommended minimum width: 2000px"
}
```

### 7. Test with Real Content

- Create test content in Universal Editor
- Inspect generated HTML with dev tools or curl
- Verify row-per-field structure matches expectations
- Test with optional fields left empty

## Migration from Document Authoring

If migrating blocks from document authoring to Universal Editor:

### 1. Analyze Current Table Structure

**Document authoring table:**
```
| Hero |
|------|
| ![Image](img.jpg) | # Title<p>Description</p><p>[CTA](link)</p> |
```

**Becomes this structure:**
- Row 0, Cell 0: Image
- Row 0, Cell 1: Title, description, CTA (all in one cell)

### 2. Design Universal Editor Model

Extract the distinct content elements:
- Image → `image` field (reference)
- Title → `title` field (text-input)
- Description + CTA → `text` field (richtext)

```json
{
  "fields": [
    {"component": "reference", "name": "image"},
    {"component": "text-input", "name": "imageAlt"},
    {"component": "text-input", "name": "title"},
    {"component": "richtext", "name": "text"}
  ]
}
```

### 3. Update Decoration Code

**Document authoring code:**
```javascript
const cells = [...rows[0].children];  // ❌
const picture = cells[0]?.querySelector('picture');
const h1 = cells[1]?.querySelector('h1');
const description = cells[1]?.querySelector('p');
```

**Universal Editor code:**
```javascript
const rows = [...block.children];  // ✅
const picture = rows[0]?.querySelector('picture');
const titleText = rows[1]?.textContent?.trim();
const richTextRow = rows[2];

// Create H1 from plain text
const h1 = document.createElement('h1');
h1.textContent = titleText;
```

### 4. Create Test Content

Create test content in Universal Editor matching the new model structure, and verify the generated HTML matches expectations.

## Troubleshooting

### Issue: Field creates unexpected row

**Check:**
- Is field name using a collapse suffix (Alt, Title, Text, Type)?
- These fields are embedded, not separate rows

### Issue: Fields not grouping as expected

**Check:**
- Are all fields in the group using the same prefix before underscore?
- Example: `cta_link`, `cta_text` (both start with `cta_`)

### Issue: Wrong number of rows generated

**Remember:**
- Each field = one row, EXCEPT fields with collapse suffixes
- Element grouping (underscore names) combines multiple fields into one row
- Count visible rows, not model fields

### Issue: Can't extract content from decoration code

**Check:**
- Are you extracting from `rows[index]` not `rows[0].children[index]`?
- Is content in the expected row based on model field order?
- Use `console.log(block.innerHTML)` to inspect actual structure

## Quick Reference

### Field Collapse Suffixes
- `Alt` → img alt attribute
- `Title` → link title attribute
- `Text` → link text content
- `Type` → semantic element or style class

### Element Grouping
- Pattern: `{groupName}_{fieldName}`
- Combines fields into one cell/row
- Works with block options: `classes_variantName`

### DOM Structure Formula
```
Visible Rows = Total Fields - Collapse Fields
Grouped Rows = Count of unique group prefixes
```

### Decoration Code Pattern
```javascript
export default async function decorate(block) {
  const rows = [...block.children];
  
  // Extract from rows (not cells)
  const field1 = rows[0];
  const field2Text = rows[1]?.textContent?.trim();
  
  // Create semantic HTML from plain text
  const heading = document.createElement('h1');
  heading.textContent = field2Text;
  
  // Transform DOM
  block.textContent = '';
  block.append(heading);
}
```

## Additional Resources

- [Universal Editor Developer Tutorial](https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/edge-dev-getting-started.html)
- [Component Model Definitions](https://www.aem.live/developer/component-model-definitions)
- [Block Collection](https://www.aem.live/developer/block-collection) - Universal Editor examples

---

*This resource is specific to Universal Editor projects. For document-based authoring (Google Docs/SharePoint), see `canonical-models.md` instead.*
