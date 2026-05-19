---
name: Modeling Content
description: Create effective content models for your blocks that are easy for authors to work with. Use this skill anytime you are building new blocks, making changes to existing blocks that modify the initial structure authors work with.
---

# Content Modeling for AEM Edge Delivery Blocks

This skill guides you through designing content models for AEM Edge Delivery Services blocks. A content model defines the HTML table structure that authors work with when creating content in their CMS (Google Docs, SharePoint, etc.).

## Related Skills

- **content-driven-development**: This skill is typically invoked FROM the CDD skill during Phase 1 (Content Model Design)
- **building-blocks**: After content modeling is complete, this skill handles implementation
- **block-collection-and-party**: Use to find similar blocks and their content models for reference

## When to Use This Skill

Use this skill when:
- Creating new blocks and need to design the author-facing content structure
- Modifying existing blocks in ways that change what authors work with
- Reviewing content models for conformance to best practices
- Migrating or refactoring content models

**Note:** This skill is usually invoked automatically by the **content-driven-development** skill at Step 1.2. If you're not already in a CDD workflow and are creating a new block, consider invoking the CDD skill first.

## Core Principles

A good content model is:

- **Semantic**: Structure carries meaning on its own without decoration
- **Predictable**: Authors, developers, and agents all know what to expect
- **Reusable**: Works across authoring surfaces and projects

## Prerequisites

Before designing a content model, ensure you understand:

1. **Project Type**: Is this a document-based authoring project (Google Docs/SharePoint) or Universal Editor project?
   - Check for `component-models.json`, `component-definitions.json`, or `_blockname.json` files → Universal Editor
   - Check for `.docx` or `.md` content files → Document authoring
2. **Block Purpose**: What is this block meant to accomplish?
3. **Content Requirements**: What content elements are needed (images, text, links, etc.)?
4. **User Experience**: How should this block appear and function on the page?

**CRITICAL:** Universal Editor and document authoring have completely different content modeling approaches. Use the correct workflow for your project type.

## The Content Modeling Process

### Step 0: Identify Project Type

**First, determine whether this is a Universal Editor or document authoring project:**

1. Check for Universal Editor indicators:
   - `component-models.json` file in project root
   - `component-definitions.json` file in project root  
   - Existing `_blockname.json` files in block directories

2. If Universal Editor detected → Use Universal Editor workflow (skip to Step 0.1)
3. If document authoring → Use canonical model workflow (skip to Step 1)

#### Step 0.1: Universal Editor Content Modeling

**For Universal Editor projects, follow this different approach:**

Universal Editor uses component model JSON files rather than table-based structures. The content model defines:
- Field types (text-input, richtext, reference, etc.)
- Field names (with naming conventions for collapse and grouping)
- Field labels and descriptions for authors

**Critical concepts:**
- Each model field creates **one row** in the DOM (row-per-field pattern)
- Fields with suffixes (Alt, Title, Text, Type) are **embedded as attributes**, not separate rows
- Use **underscores** for element grouping (`groupName_fieldName`)
- Model lives in `_blockname.json` file at block level

**Read the Universal Editor resource:**

Read `resources/universal-editor-models.md` for complete guidance on:
- Creating `_blockname.json` files
- Field component types
- Row-per-field structure
- Field naming conventions (collapse and grouping)
- Multi-fields and container blocks
- Best practices for Universal Editor models

**After reading, design your model following these patterns:**

1. Choose appropriate field components (text-input, richtext, reference, etc.)
2. Apply naming conventions:
   - Use `imageAlt` for image alt text (embedded)
   - Use `buttonText` for button text (embedded)
   - Use `groupName_fieldName` for grouping
3. Minimize field count (aim for 3-6 fields, max 4 visible rows due to ESLint rule)
4. Document the model with clear labels

**Universal Editor Configuration Files:**

After creating the `_blockname.json` model, you must register the block in FOUR configuration files:

1. **`component-models.json`** - Add your model with exact field definitions
2. **`component-definition.json`** - Add to Blocks group for component picker
3. **`component-filters.json`** - Add to section filter
4. **`models/_section.json`** - Add to section components

**CRITICAL:** Keep `component-models.json` synchronized with `_blockname.json`:
- When you add/rename/remove/reorder fields, update both files
- Copy the EXACT `fields` array from `_blockname.json` to `component-models.json`

**Return to calling skill with:**
- The `_blockname.json` content
- Expected row structure (X visible rows from Y model fields)
- Notes about embedded fields and grouping
- Reminder to register in all 4 configuration files

**Then STOP - do not proceed to Steps 1-4 below. Those steps are for document authoring only.**

---

### Document Authoring Workflow (Steps 1-4)

**The steps below apply ONLY to document-based authoring projects (Google Docs/SharePoint).
If you are working on a Universal Editor project, you should have already completed Step 0.1 and stopped.**

### Step 1: Identify the Canonical Model Type(s)

AEM Edge Delivery has 4 canonical block models. While these cover the most common cases, sometimes the best approach is to support multiple models for the same block to accommodate different authoring workflows and content complexity.

Review the descriptions in `resources/canonical-models.md` and identify which model(s) fit best:

- **Standalone**: Best for distinct visual or narrative elements (Hero, Blockquote)
- **Collection**: Ideal for repeating semi-structured content (Cards, Carousel)
- **Configuration**: Use ONLY for API-driven or dynamic content where config controls display (Blog Listing, Search Results)
- **Auto-Blocked**: Good for simplifying authoring of complex structures and block nesting (Tabs, YouTube Embed)

**Consider these questions as a starting point** (note: content modeling is an art, not a science - use these as guidelines, not strict rules):
- Is this a unique, one-off element? → Often Standalone
- Is this a repeating list of similar items? → Often Collection
- Does this pull data from an API or require behavior configuration? → Likely Configuration
- Does this block require nesting other blocks, or use a complex structure that authors could more easily create as sections or default content that gets transformed into the block? → Consider Auto-Blocked

**Important:** Consider if multiple models should be supported. For example:
- Simple cases might work best as Collection
- Complex cases (with nested blocks) might need Auto-Blocked
- Both can be equally valid - let decoration code handle the variations

See `resources/advanced-scenarios.md` for patterns on supporting multiple models for one block.

### Step 2: Design the Table Structure

Design your table structure following these key guidelines:

**Key Guidelines:**
- Limit to maximum 4 cells per row - group like elements into cells
- Apply semantic formatting (headings, bold, italic) to define meaning
- Prefer block variants over config cells
- Infer from context and use smart defaults to limit what authors must input
- Follow Postel's Law: "be conservative in what you do, be liberal in what you accept from others"
  - Be flexible about the input structure authors provide. For example, in a hero block, all elements could be in one cell, split across 2 cells in one row, or in 2 separate rows - any of these can work with proper decoration code (it's just query selectors)
  - Don't be overly prescriptive about structure when flexibility makes sense
  - The goal is to make authoring easier, not to enforce rigid structures for developer convenience

**For each canonical model:**

**Standalone blocks:**
- Use rows or columns as needed for the unique structure
- Be flexible about how authors organize content - your decoration code can handle variations
- Use semantic formatting to identify elements (bold for headings, etc.) rather than rigid cell positions
- Example: Hero block where image and text could be in separate rows, separate columns, or even combined - decoration code uses query selectors to find what it needs

**Collection blocks:**
- Each row represents an item
- Columns define the parts of each item
- Keep columns consistent across all rows
- Example: Cards with columns for image, heading, description

**Configuration blocks:**
- Two-column key/value pairs for settings or parameters
- Keys in left column, values in right column
- Keep configuration minimal - only true behavioral settings
- Example: Blog Listing with keys like `limit | 10`, `sort | date-desc`, `tags | technology,news`

**Auto-Blocked:**
- Design for the simplest possible authoring experience
- Often uses sections and section metadata to provide context
- The pattern detection should feel "magical" to authors
- Example: Tabs block that auto-blocks from a section containing multiple H2 headings with content, using section metadata for styling options

### Step 3: Validate Against Best Practices

Use this checklist to validate your content model:

- [ ] Uses the appropriate canonical model type
- [ ] Maximum 4 cells per row
- [ ] Semantic formatting defines meaning (not just visual styling)
- [ ] Model is predictable (clear what goes where)
- [ ] Model is reusable (works across different authoring tools)
- [ ] Smart defaults minimize required author input
- [ ] Avoids configuration cells unless truly needed for dynamic content
- [ ] Cell names/purposes are clear and meaningful
- [ ] Consider edge cases (empty cells, optional content, etc.)

**Common Anti-Patterns to Avoid:**
- ❌ Too many columns (>4 per row)
- ❌ Using Configuration model when Standalone or Collection would work
- ❌ Non-semantic cell content (e.g., "column1", "column2")
- ❌ Requiring authors to input data that could be inferred or defaulted
- ❌ Complex nested structures that confuse authors
- ❌ Models that only work in one specific authoring tool

### Step 4: Document the Content Model

Provide the content model back to the calling skill (or user) in this format:

```markdown
## Content Model: [Block Name]

### Block Type
[Standalone | Collection | Configuration | Auto-Blocked]

### Table Structure

| Block Name |
|------------|
| [Cell description] |
| [Cell description] | [Cell description] |

### How It Works
[Explain what authors create and how the table structure works. Describe the purpose of each row/column and any semantic formatting used.]

### Key Points
- [Important authoring guidelines]
- [Examples of semantic formatting (e.g., "bold text indicates the heading")]
- [Any flexibility in structure (e.g., "content can be in one cell or split across two")]
- [Common variants if applicable]
```

**Important:** This skill focuses on designing the content model. The calling skill (content-driven-development or building-blocks) will handle what to do with it next, such as creating test content or implementing the block.

## Resources

**For All Projects:**
- `resources/advanced-scenarios.md` - Nested blocks, complex patterns, edge cases

**For Document Authoring (Google Docs/SharePoint):**
- `resources/canonical-models.md` - The 4 canonical model types with detailed examples and best practices

**For Universal Editor (AEM as a Cloud Service):**
- `resources/universal-editor-models.md` - Complete guide to component models, field types, naming conventions, row-per-field structure

## Example Workflow

**Scenario:** User needs to create a hero block with an image, heading, and call-to-action

**Process:**

1. **Identify Model Type**:
   - This is likely a Standalone block (distinct visual element, typically appears once)
   - Could also work as a simple Collection if multiple heroes are needed, but Standalone is more common

2. **Design Structure**:
   - Start with a flexible approach that uses semantic formatting
   - Authors could structure this multiple ways - decoration code will handle variations

3. **Validate**:
   - ✅ Standalone model (appropriate for hero)
   - ✅ Semantic formatting will identify elements (H1 for heading, links for CTA)
   - ✅ Flexible structure - can work with different layouts
   - ✅ Reusable (works in any authoring tool)
   - ✅ Under 4 cells per row

4. **Document and Return to Calling Skill**:
   ```markdown
   ## Content Model: Hero

   ### Block Type
   Standalone

   ### Table Structure
   | Hero |
   |------|
   | [Image] |
   | [Heading, description, and CTA] |

   ### How It Works
   Authors create a hero block using a simple table. The structure is flexible:
   - Image can be in its own row or column
   - Text content (heading, description, CTA) can be together or separated
   - Decoration code uses semantic formatting to identify elements:
     - H1 or bold text → heading
     - Regular paragraphs → description
     - Links → call-to-action

   ### Key Points
   - Use H1 or bold formatting for the main heading
   - Structure is flexible - all content in one row, split across two rows, or in columns all work
   - Image should be high-resolution (minimum 2000px wide for full-width heroes)
   - Variants available: `Hero (Dark)`, `Hero (Centered)`, etc.
   ```

   *Skill returns this content model to CDD or building-blocks skill for next steps.*

## Integration with Other Skills

**Called from content-driven-development:**
- CDD invokes this skill at Step 1.2 when new content models are needed
- After completing this skill, return to CDD to continue with content creation

**Calls to other skills:**
- May reference **block-collection-and-party** to find similar blocks for pattern inspiration
- Completed models are used by **building-blocks** during implementation

## Key Takeaways

1. **Choose the right canonical model first** - this drives everything else
2. **Keep it simple** - authors should understand the model intuitively
3. **Use semantic formatting** - let the structure carry meaning
4. **Validate ruthlessly** - check against all best practices before finalizing
5. **Document clearly** - both the structure and the reasoning behind it

Content models are the foundation of author experience. Invest time here to create intuitive, maintainable structures that serve authors well.
