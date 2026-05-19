---
name: Building Blocks
description: Guide for creating new AEM Edge Delivery blocks or modifying existing blocks. Use this skill whenever you are creating a new block from scratch or making significant changes to existing blocks that involve JavaScript decoration, CSS styling, or content model changes.
---

# Building Blocks

This skill guides you through creating new AEM Edge Delivery blocks or modifying existing ones, following Content Driven Development (CDD) principles. Blocks are the reusable building blocks of AEM sites - each transforms authored content into rich, interactive experiences through JavaScript decoration and CSS styling. This skill covers the complete development process: understanding content models, implementing decoration logic, applying styles, and maintaining code quality standards.

## Related Skills

- **content-driven-development**: MUST be invoked before using this skill to ensure content and content models are ready
- **block-collection-and-party**: Use to find similar blocks for patterns
- **testing-blocks**: Automatically invoked after implementation for comprehensive testing

## When to Use This Skill

This skill should ONLY be invoked from the **content-driven-development** skill during Phase 2 (Implementation).

If you are not already following the CDD process:
- **STOP** - Do not proceed with this skill
- **Invoke the content-driven-development skill first**
- The CDD skill will ensure test content and content models are ready before implementation

This skill handles:
- Creating new block files and structure
- Implementing JavaScript decoration
- Adding CSS styling
- Code quality and testing

## Prerequisites

**REQUIRED before using this skill:**
- ✅ Test content must exist (in CMS or local drafts)
- ✅ Content model must be defined
- ✅ Test content URL must be available

**Information needed:**
1. **Block name**: What should the block be called?
2. **Content model**: The defined structure authors will use
3. **Test content URL**: Path to test content for development

## Process Overview

1. Verify Prerequisites (CDD completed)
2. Find Similar Blocks (for patterns and reuse)
3. Create or Modify Block Structure (files and directories)
4. Implement JavaScript Decoration (DOM transformation)
5. Add CSS Styling (scoped, responsive styles)
6. Test the Implementation (local testing, linting)
7. Document Block (developer and author-facing docs)

## Detailed Process

### 1. Verify Prerequisites

**Before proceeding, confirm with the user:**

"Do you have:
- ✅ Test content created (URL or path)?
- ✅ Content model defined?

If not, we need to use the content-driven-development skill first."

If prerequisites are not met, STOP and invoke the **content-driven-development** skill.

If prerequisites are met, get the test content URL from the user and proceed to step 2.

### 2. Find Similar Blocks

**For new blocks or major modifications:**

1. Search the codebase for similar blocks that might provide useful patterns or code we can re-use
2. Use the **block-collection-and-party** skill to find relevant reference blocks

Review the implementation patterns in similar blocks to inform your approach.

**For minor modifications to existing blocks:** Skip to step 3.

### 3. Create or Modify Block Structure

**First, determine if this is a Universal Editor project:**

Check for indicators:
- `component-models.json` or `component-definitions.json` in project root
- Existing `_blockname.json` files in block directories

If Universal Editor detected, follow **Option A**. Otherwise, follow **Option B**.

#### Option A: Universal Editor Projects

**For new blocks:**

1. Create directory: `blocks/{block-name}/`
2. Create files: `{block-name}.js`, `{block-name}.css`, and `_{block-name}.json`
3. Create the component model configuration file `_{block-name}.json`:

```json
{
  "definitions": [{
    "title": "Block Display Name",
    "id": "block-name",
    "plugins": {
      "xwalk": {
        "page": {
          "resourceType": "core/franklin/components/block/v1/block",
          "template": {
            "name": "Block Name",
            "model": "block-name"
          }
        }
      }
    }
  }],
  "models": [{
    "id": "block-name",
    "fields": [
      // Field definitions from content model
    ]
  }],
  "filters": []
}
```

**Note:** Always include an empty `filters: []` array, even for simple blocks. This provides consistency and allows for future extensibility.

4. **Register the block in Universal Editor configuration files** to make it available for authors:

   **CRITICAL:** Universal Editor blocks must be registered in FOUR configuration files:

   **a) Register in `models/_section.json`:**
   - Open `models/_section.json`
   - Add your block ID to the `components` array within the `filters` section (alphabetically)
   - Example: If creating an "actiontile" block, add `"actiontile"` to the array

   ```json
   "filters": [
     {
       "id": "section",
       "components": [
         "actiontile",  // ← Add new blocks alphabetically
         "button",
         "cards",
         "columns",
         "hero",
         "image",
         "text"
       ]
     }
   ]
   ```

   **b) Register in `component-definition.json`:**
   - Open `component-definition.json` in project root
   - Locate the `"Blocks"` group in the `groups` array
   - Add your block definition to the `components` array (alphabetically by title)

   ```json
   {
     "title": "Blocks",
     "id": "blocks",
     "components": [
       {
         "title": "ActionTile",  // Display name in UI
         "id": "actiontile",      // Must match block folder name
         "plugins": {
           "xwalk": {
             "page": {
               "resourceType": "core/franklin/components/block/v1/block",
               "template": {
                 "name": "ActionTile",
                 "model": "actiontile"  // Must match model ID
               }
             }
           }
         }
       },
       // ... other blocks
     ]
   }
   ```

   **c) Register in `component-models.json`:**
   - Open `component-models.json` in project root
   - Add your model object to the array (alphabetically by ID at the beginning)
   - Copy the EXACT `fields` array from your `_blockname.json` file

   ```json
   [
     {
       "id": "actiontile",  // Must match block name
       "fields": [
         // Copy fields array from blocks/actiontile/_actiontile.json
       ]
     },
     // ... other models
   ]
   ```

   **CRITICAL:** Keep `component-models.json` synchronized with `_blockname.json`:
   - When you add/rename/remove/reorder fields in `_blockname.json`, update `component-models.json`
   - These files must stay in sync or content models will break

   **d) Register in `component-filters.json`:**
   - Open `component-filters.json` in project root
   - Find the filter object with `"id": "section"`
   - Add your block ID to the `components` array (alphabetically)

   ```json
   [
     {
       "id": "section",
       "components": [
         "actiontile",  // ← Add new blocks alphabetically
         "button",
         "cards",
         "columns",
         "hero"
       ]
     }
   ]
   ```

   **Registration Checklist - All FOUR files required:**
   - [ ] `models/_section.json` - Added to filters.components
   - [ ] `component-definition.json` - Added to Blocks group
   - [ ] `component-models.json` - Added model with all fields
   - [ ] `component-filters.json` - Added to section filter

   **Without complete registration:**
   - ❌ Block won't appear in Universal Editor component picker
   - ❌ Authors can't add block to pages
   - ❌ Content models may not render correctly

5. Use the boilerplate structure for JS and CSS files:
   - JS file exports a default `decorate(block)` function (can be async if needed)
   - CSS file targets the `.{block-name}` class

**For existing blocks:**

1. Locate the existing block directory in `blocks/{block-name}/`
2. Review the current `_{block-name}.json` model configuration
3. Review the current JavaScript and CSS implementation
4. Understand how the row-per-field structure is being processed

**CRITICAL for Universal Editor:**
- The `_{block-name}.json` file defines what authors can edit
- Each model field creates ONE ROW in the block DOM
- Fields with suffixes (Alt, Title, Text, Type) are embedded as attributes
- Your decoration code must extract from `rows[index]`, not `rows[0].children[index]`

#### Option B: Document Authoring Projects

**For new blocks:**

1. Create directory: `blocks/{block-name}/`
2. Create files: `{block-name}.js` and `{block-name}.css`
3. Use the boilerplate structure (or reference templates in `resources/` if helpful):
   - JS file exports a default `decorate(block)` function (can be async if needed)
   - CSS file targets the `.{block-name}` class

**For existing blocks:**

1. Locate the existing block directory in `blocks/{block-name}/`
2. Review the current implementation before making changes
3. Understand the existing decoration logic and styles

### 4. Implement JavaScript Decoration

Follow patterns and conventions in `resources/js-guidelines.md`:

- Use DOM APIs to transform the initial block HTML structure
- Keep decoration logic focused and single-purpose
- Handle variants appropriately (check block.classList for variant classes)
- Follow established patterns from similar blocks

**For Universal Editor projects specifically:**

1. **Extract from rows, not cells:**
   ```javascript
   const rows = [...block.children];
   const picture = rows[0]?.querySelector('picture');  // ✅ Correct
   const cells = [...rows[0].children];  // ❌ Wrong for Universal Editor
   ```

2. **Create semantic HTML from plain text fields:**
   ```javascript
   const titleText = rows[1]?.textContent?.trim();
   if (titleText) {
     const h1 = document.createElement('h1');
     h1.textContent = titleText;
     // Add to DOM
   }
   ```

3. **Handle embedded fields correctly:**
   - `imageAlt` fields are already in the img alt attribute
   - `linkText` fields are already in the anchor text
   - Don't look for separate rows for these fields

4. **Map row index to model field order:**
   - Row 0 = first field in model
   - Row 1 = second field (unless first had collapse suffix)
   - Remember: collapse suffix fields don't create visible rows

**Read `resources/js-guidelines.md` for detailed examples, code standards, and best practices.**

### 5. Add CSS Styling

Follow patterns and conventions in `resources/css-guidelines.md`:

- All CSS selectors must be scoped to the block (start with `.{block-name}`)
- Use BEM-like naming within the block scope
- Leverage CSS custom properties for theming
- Write mobile-first responsive styles
- Keep specificity low
- Follow established patterns from similar blocks

**Read `resources/css-guidelines.md` for detailed examples, code standards, and best practices.**

### 6. Test the Implementation

**After implementation is complete, invoke the testing-blocks skill:**

The testing-blocks skill will guide you through:
- Writing unit tests for any logic-heavy utilities
- Browser testing to validate block behavior
- Taking screenshots for validation and PR documentation
- Running linting and fixing issues
- Verifying GitHub checks pass

Provide the testing-blocks skill with:
- Block name being tested
- Test content URL (from CDD process)
- Any variants that need testing

Return to this skill after testing is complete to proceed to step 7.

### 7. Document Block

Blocks require two types of documentation:

#### Developer Documentation

- Most blocks are simple and self-contained and only need code comments for documentation
- If a block is especially complex (has many variants, or especially complex code) consider adding a brief README.md in the block folder
- Keep any README documentation very brief so it can be consumed at a glance

#### Author-Facing Documentation

Author-facing documentation helps content authors understand how to use the block in the CMS. This documentation typically exists as draft/library content in the CMS itself, not in the codebase.

**When author documentation is needed:**

Almost all blocks should have author-facing documentation. The only exceptions are:
- Deprecated blocks that should no longer be used but can't be removed yet
- Special-purpose blocks used very infrequently on a need-to-know basis
- Auto-blocked blocks that shouldn't be used directly by authors

**Maintaining author documentation:**

Author documentation must be kept in sync with the block implementation:
- Update when variants are added, removed, or modified
- Update when the content structure changes
- Update when block behavior or functionality changes

**Where author documentation lives:**

Different projects use different approaches for author documentation:

1. **Sidekick Library** (Google Drive/SharePoint authoring):
   - Uses https://github.com/adobe/franklin-sidekick-library
   - Check for `/tools/sidekick/library.html` in the codebase
   - If present, guide user to add/update block documentation in the library

2. **Document Authoring (DA) Library**:
   - Uses https://docs.da.live/administrators/guides/setup-library
   - Different implementation than Sidekick Library
   - If in use, guide user to update block documentation in DA library

3. **Universal Editor (UE) projects**:
   - Often skip dedicated author documentation libraries
   - May use inline help or other mechanisms

4. **Simple documentation pages**:
   - Some projects maintain documentation under `/drafts` or `/docs`
   - Pages contain authoring guides and block examples

**What to include in author documentation:**

The specific content of author documentation varies by project. As an agent:
1. Identify that author documentation needs to be created or updated
2. Determine which documentation approach the project uses (check for `/tools/sidekick/library.html` as a signal)
3. Guide the user on what aspects of the block should be documented based on the changes made
4. Provide specific guidance based on the project's documentation approach

## Reference Materials

- `resources/js-guidelines.md`
- `resources/css-guidelines.md`
