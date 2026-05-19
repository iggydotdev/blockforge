# Universal Editor Example: Hero Banner Block

This document provides a complete real-world example of creating a block for Universal Editor, based on the `hero-banner` block created in this project.

## Block Overview

**Block Name:** hero-banner  
**Block Type:** Standalone  
**Purpose:** Full-width hero banner with background image, title, subtitle, description, and call-to-action buttons

## Content Model Design

### Requirements

The block needs to support:
- Background image with alt text
- Title (main heading - H1)
- Subtitle (secondary heading - H2)
- Description text with formatting
- Two call-to-action buttons (primary and secondary)

### Model Fields

```json
{
  "id": "hero-banner",
  "fields": [
    {
      "component": "reference",
      "valueType": "string",
      "name": "image",
      "label": "Background Image",
      "multi": false
    },
    {
      "component": "text-input",
      "valueType": "string",
      "name": "imageAlt",
      "label": "Image Alt Text"
    },
    {
      "component": "text-input",
      "valueType": "string",
      "name": "title",
      "label": "Title"
    },
    {
      "component": "text-input",
      "valueType": "string",
      "name": "subtitle",
      "label": "Subtitle"
    },
    {
      "component": "richtext",
      "name": "text",
      "label": "Description and CTAs",
      "valueType": "string"
    }
  ]
}
```

### Field Count vs. Row Count

**Model fields:** 5 (image, imageAlt, title, subtitle, text)  
**Visible rows:** 4

**Why?** The `imageAlt` field uses the **Alt suffix pattern** and is embedded in the img alt attribute, not a separate row.

## DOM Structure

### Generated HTML

Given this author input:
- Image: `/content/dam/hero-bg.jpg`
- Image Alt: "A group of people collaborating"
- Title: "Welcome to Our Platform"
- Subtitle: "Transforming Ideas into Reality"
- Text: `<p>We help teams build amazing experiences.</p><p><a href="/learn-more">Learn More</a> <a href="/contact">Contact Us</a></p>`

Universal Editor generates:

```html
<div class="hero-banner">
  <div><div>
    <picture>
      <img src="/content/dam/hero-bg.jpg" alt="A group of people collaborating">
    </picture>
  </div></div>                                              <!-- Row 0: image -->
  <div><div>Welcome to Our Platform</div></div>            <!-- Row 1: title -->
  <div><div>Transforming Ideas into Reality</div></div>    <!-- Row 2: subtitle -->
  <div><div>                                               <!-- Row 3: text -->
    <p>We help teams build amazing experiences.</p>
    <p><a href="/learn-more">Learn More</a> <a href="/contact">Contact Us</a></p>
  </div></div>
</div>
```

**Key observations:**
1. Row 0 contains the picture element (image field)
2. `imageAlt` value is in the img alt attribute - no separate row
3. Row 1 contains plain text (title field) - needs conversion to H1
4. Row 2 contains plain text (subtitle field) - needs conversion to H2
5. Row 3 contains rich HTML (text field) - already has paragraphs and links

## JavaScript Decoration

### Complete Implementation

```javascript
/**
 * decorates the hero-banner block
 * @param {Element} block the hero-banner block element
 */
export default async function decorate(block) {
  // Universal Editor row-per-field structure:
  // Each model field creates a separate row
  // Expected rows: [image, title, subtitle, text]
  // Note: imageAlt is embedded in the img alt attribute, not a separate row

  const rows = [...block.children];
  if (rows.length === 0) return;

  // Extract values from rows based on the model definition order
  // Row 0: image (contains picture element)
  // Row 1: title (plain text)
  // Row 2: subtitle (plain text)
  // Row 3: text (richtext with description and CTAs)
  const picture = rows[0]?.querySelector('picture');
  const titleText = rows[1]?.textContent?.trim();
  const subtitleText = rows[2]?.textContent?.trim();
  const richTextRow = rows[3]; // Contains description and CTAs

  // Clear the block
  block.textContent = '';

  // Add background image if present
  if (picture) {
    const heroBackground = document.createElement('div');
    heroBackground.className = 'hero-banner-background';
    heroBackground.append(picture);
    block.append(heroBackground);
  }

  // Create content wrapper
  const heroContent = document.createElement('div');
  heroContent.className = 'hero-banner-content';

  const heroText = document.createElement('div');
  heroText.className = 'hero-banner-text';

  // Create and add title (H1)
  if (titleText) {
    const h1 = document.createElement('h1');
    h1.className = 'hero-banner-title';
    h1.textContent = titleText;
    heroText.append(h1);
  }

  // Create and add subtitle (H2)
  if (subtitleText) {
    const h2 = document.createElement('h2');
    h2.className = 'hero-banner-subtitle';
    h2.textContent = subtitleText;
    heroText.append(h2);
  }

  // Add description and CTAs from rich text row
  if (richTextRow) {
    const description = document.createElement('div');
    description.className = 'hero-banner-description';

    // Extract paragraphs (description)
    const paragraphs = richTextRow.querySelectorAll('p');
    paragraphs.forEach((p) => {
      const hasLinks = p.querySelector('a');
      const textContent = p.textContent.trim();

      // Include paragraph if it has text (excluding link-only paragraphs)
      if (!hasLinks || textContent.length > 0) {
        const descPara = p.cloneNode(true);
        // Remove links from description paragraphs
        descPara.querySelectorAll('a').forEach((a) => a.remove());
        if (descPara.textContent.trim()) {
          description.append(descPara);
        }
      }
    });

    if (description.children.length > 0) {
      heroText.append(description);
    }

    // Extract CTAs (links)
    const links = richTextRow.querySelectorAll('a');
    if (links.length > 0) {
      const ctaWrapper = document.createElement('div');
      ctaWrapper.className = 'hero-banner-ctas';

      links.forEach((link, index) => {
        const ctaLink = link.cloneNode(true);
        // First link is primary, second is secondary
        if (index === 0) {
          ctaLink.className = 'button primary';
        } else if (index === 1) {
          ctaLink.className = 'button secondary';
        } else {
          ctaLink.className = 'button';
        }
        ctaWrapper.append(ctaLink);
      });

      heroText.append(ctaWrapper);
    }
  }

  heroContent.append(heroText);
  block.append(heroContent);
}
```

### Key Patterns Used

1. **Row Extraction:** `const rows = [...block.children]` - Extract all rows, not cells
2. **Row Mapping:** 
   - `rows[0]` = image field
   - `rows[1]` = title field (plain text)
   - `rows[2]` = subtitle field (plain text)
   - `rows[3]` = text field (richtext)
3. **Semantic HTML Creation:** Create H1 and H2 from plain text using `document.createElement()`
4. **Content Separation:** Separate description paragraphs from CTA links within richtext field
5. **Element Re-use:** Re-use existing picture element and anchor tags
6. **Button Styling:** Apply `.button.primary` and `.button.secondary` classes to CTAs

## CSS Styling

### Complete Styles

```css
.hero-banner {
  position: relative;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-banner-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.hero-banner-background picture {
  display: block;
  width: 100%;
  height: 100%;
}

.hero-banner-background img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.hero-banner-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1200px;
  padding: 2rem;
}

.hero-banner-text {
  text-align: center;
  color: white;
}

.hero-banner-title,
.hero-banner-subtitle,
.hero-banner-description {
  text-shadow: 0 2px 4px rgb(0 0 0 / 50%);
}

.hero-banner-title {
  font-size: 2.5rem;
  font-weight: bold;
  margin: 0 0 1rem;
  line-height: 1.2;
}

.hero-banner-subtitle {
  font-size: 1.5rem;
  font-weight: 500;
  margin: 0 0 1.5rem;
  line-height: 1.3;
}

.hero-banner-description {
  font-size: 1.125rem;
  margin: 0 0 2rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.hero-banner-ctas {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Responsive adjustments */
@media (min-width: 600px) {
  .hero-banner {
    min-height: 600px;
  }

  .hero-banner-title {
    font-size: 3rem;
  }

  .hero-banner-subtitle {
    font-size: 1.75rem;
  }
}

@media (min-width: 900px) {
  .hero-banner {
    min-height: 700px;
  }

  .hero-banner-title {
    font-size: 3.5rem;
  }

  .hero-banner-subtitle {
    font-size: 2rem;
  }
}
```

### CSS Best Practices Demonstrated

1. **Scoped selectors:** All selectors start with `.hero-banner`
2. **BEM-like naming:** `.hero-banner-title`, `.hero-banner-content`, etc.
3. **Mobile-first:** Base styles for mobile, progressive enhancement via media queries
4. **Responsive breakpoints:** 600px, 900px
5. **Modern CSS:** `object-fit`, `rgb()` with alpha, flexbox, gap
6. **Accessibility:** Text shadow for readability over images

## Component Configuration

### `_hero-banner.json`

```json
{
  "definitions": [{
    "title": "Hero Banner",
    "id": "hero-banner",
    "plugins": {
      "xwalk": {
        "page": {
          "resourceType": "core/franklin/components/block/v1/block",
          "template": {
            "name": "Hero Banner",
            "model": "hero-banner"
          }
        }
      }
    }
  }],
  "models": [{
    "id": "hero-banner",
    "fields": [
      {
        "component": "reference",
        "valueType": "string",
        "name": "image",
        "label": "Background Image",
        "multi": false
      },
      {
        "component": "text-input",
        "valueType": "string",
        "name": "imageAlt",
        "label": "Image Alt Text"
      },
      {
        "component": "text-input",
        "valueType": "string",
        "name": "title",
        "label": "Title"
      },
      {
        "component": "text-input",
        "valueType": "string",
        "name": "subtitle",
        "label": "Subtitle"
      },
      {
        "component": "richtext",
        "name": "text",
        "label": "Description and CTAs",
        "valueType": "string"
      }
    ]
  }]
}
```

## Test Content

### Test HTML (for local development)

File: `drafts/hero-banner-test.plain.html`

```html
<html>
<head>
  <title>Hero Banner Test</title>
</head>
<body>
  <main>
    <div>
      <!-- Example 1: Full content -->
      <div class="hero-banner">
        <div><div>
          <picture>
            <source type="image/webp" srcset="/test-assets/hero1.webp">
            <img src="/test-assets/hero1.jpg" alt="A group of people collaborating">
          </picture>
        </div></div>
        <div><div>Welcome to Our Platform</div></div>
        <div><div>Transforming Ideas into Reality</div></div>
        <div><div>
          <p>We help teams build amazing digital experiences with cutting-edge technology.</p>
          <p><a href="/learn-more">Learn More</a> <a href="/contact">Contact Us</a></p>
        </div></div>
      </div>

      <!-- Example 2: Minimal content (no subtitle, one CTA) -->
      <div class="hero-banner">
        <div><div>
          <picture>
            <source type="image/webp" srcset="/test-assets/hero2.webp">
            <img src="/test-assets/hero2.jpg" alt="Modern office space">
          </picture>
        </div></div>
        <div><div>Get Started Today</div></div>
        <div><div></div></div>
        <div><div>
          <p>Join thousands of teams already using our platform.</p>
          <p><a href="/signup">Sign Up Free</a></p>
        </div></div>
      </div>

      <!-- Example 3: No CTAs (description only) -->
      <div class="hero-banner">
        <div><div>
          <picture>
            <source type="image/webp" srcset="/test-assets/hero3.webp">
            <img src="/test-assets/hero3.jpg" alt="Team meeting">
          </picture>
        </div></div>
        <div><div>Innovation Starts Here</div></div>
        <div><div>Building the Future Together</div></div>
        <div><div>
          <p>Empowering teams to create exceptional digital experiences.</p>
        </div></div>
      </div>
    </div>
  </main>
</body>
</html>
```

## Lessons Learned

### Universal Editor Specific Insights

1. **Row-per-field is fundamental:** Every field creates a row (except embedded fields). This must be understood before writing any decoration code.

2. **Field naming matters:** Using `imageAlt` instead of `alt` triggers the field collapse pattern automatically.

3. **Plain text fields need conversion:** Title and subtitle come as plain text and must be converted to H1/H2 programmatically.

4. **Richtext is already HTML:** The text field contains fully-formed HTML that can be queried and re-used.

5. **Separation of concerns:** Keeping description and CTAs in one richtext field is simpler for authors, but requires JavaScript to separate them.

### Development Workflow Insights

1. **Inspect the DOM first:** Use `curl http://localhost:3000/drafts/test.html` or browser DevTools to see the actual structure before coding.

2. **Count rows vs. fields:** Always count visible rows (exclude embedded fields) to map row indices correctly.

3. **Test edge cases:** Create test content with optional fields missing (empty subtitle, no CTAs) to ensure graceful degradation.

4. **Console.log liberally:** Use `console.log(block.innerHTML)` during development to verify structure matches expectations.

## Common Pitfalls to Avoid

### ❌ Extracting from cells instead of rows

```javascript
// WRONG for Universal Editor
const cells = [...rows[0].children];
const picture = cells[0]?.querySelector('picture');
```

### ❌ Looking for H1 that doesn't exist

```javascript
// WRONG - title field contains plain text, not H1
const h1 = rows[1]?.querySelector('h1');
```

### ❌ Creating separate row for imageAlt

```json
// WRONG - imageAlt will be embedded, not a separate field
{
  "fields": [
    {"name": "image"},
    {"name": "imageAlt"}  // This won't create a row
  ]
}
```

Instead, count: 2 fields but only 1 visible row (image with alt embedded).

### ❌ Wrong row index mapping

```javascript
// WRONG - Off by one due to imageAlt being embedded
const titleText = rows[2]?.textContent?.trim();  // Should be rows[1]
```

## File Checklist

For a complete Universal Editor block, ensure you have:

- [ ] `blocks/{block-name}/{block-name}.js` - Decoration logic
- [ ] `blocks/{block-name}/{block-name}.css` - Scoped styles
- [ ] `blocks/{block-name}/_{block-name}.json` - Component model
- [ ] `blocks/{block-name}/README.md` - Developer documentation (optional but recommended)
- [ ] Test content (in CMS or drafts folder)
- [ ] All linting passes

## Additional Resources

- [Component Model Definitions](https://www.aem.live/developer/component-model-definitions)
- [Universal Editor Tutorial](https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/edge-dev-getting-started.html)
- [Block Collection Examples](https://www.aem.live/developer/block-collection)

---

*This example demonstrates best practices for Universal Editor block development based on real implementation of the hero-banner block in this project.*
