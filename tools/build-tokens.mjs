#!/usr/bin/env node
/*
 * Generate a CSS custom-properties file from a W3C-style design-tokens JSON.
 *
 * Usage:
 *   node tools/build-tokens.mjs [input] [output] [--prefix=NAME] [--reference=PATH]
 *
 * Defaults: input=docs/RACQ.primitives.json output=styles/variables.css
 *
 * --prefix=NAME       Prepend NAME to every generated variable
 *                     (e.g. --prefix=semantic => --semantic-color-...).
 * --reference=PATH    Load another tokens JSON, build a value->var-name map
 *                     for it, and emit `var(--ref-name)` whenever a value
 *                     matches. Use to make a semantic layer reference the
 *                     primitives layer.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDir, '..');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      flags[key] = rest.length ? rest.join('=') : true;
    } else {
      positional.push(arg);
    }
  });
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));

const inputArg = positional[0] || 'docs/RACQ.primitives.json';
const outputArg = positional[1] || 'styles/variables.css';
const inputPath = resolve(projectRoot, inputArg);
const outputPath = resolve(projectRoot, outputArg);

const prefix = typeof flags.prefix === 'string' && flags.prefix.length
  ? flags.prefix
  : '';
const referenceArg = typeof flags.reference === 'string' ? flags.reference : '';
const referencePath = referenceArg ? resolve(projectRoot, referenceArg) : '';

// Categories whose number values should be emitted as pixels.
const PX_CATEGORIES = new Set([
  'spacing',
  'size',
  'radius',
  'border',
  'stroke',
]);

// Typography keys (as either path-segment-1 or leaf key) whose number values
// are pixels.
const TYPOGRAPHY_PX_KEYS = new Set([
  'size',
  'lineHeight',
  'paragraphSpacing',
  'listSpacing',
  'fontSize',
]);

// Typography keys whose values are unitless numbers.
const TYPOGRAPHY_UNITLESS_KEYS = new Set([
  'weight',
  'fontWeight',
  'letterSpacing',
]);

/**
 * Convert a token path segment to a kebab-case CSS-safe fragment.
 * Handles negative numbers (e.g. "-1" => "minus-1") and camelCase keys.
 */
function segmentToKebab(segment) {
  let s = String(segment);
  if (/^-\d/.test(s)) {
    s = `minus-${s.slice(1)}`;
  }
  // camelCase -> kebab
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  // any whitespace or underscore -> hyphen
  s = s.replace(/[\s_]+/g, '-');
  return s.toLowerCase();
}

function pathToVarName(pathParts, varPrefix) {
  const segments = varPrefix ? [varPrefix, ...pathParts] : pathParts;
  return `--${segments.map(segmentToKebab).join('-')}`;
}

function isLeaf(node) {
  return node && typeof node === 'object' && '$type' in node && '$value' in node;
}

/**
 * Format a color leaf's $value into a CSS color string.
 * Uses hex when alpha === 1, rgba() otherwise.
 */
function shortenHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex.toLowerCase();
  const [r1, r2, g1, g2, b1, b2] = m[1];
  if (r1.toLowerCase() === r2.toLowerCase()
    && g1.toLowerCase() === g2.toLowerCase()
    && b1.toLowerCase() === b2.toLowerCase()) {
    return `#${r1}${g1}${b1}`.toLowerCase();
  }
  return `#${m[1]}`.toLowerCase();
}

function formatColor(value) {
  if (!value || typeof value !== 'object') return String(value);
  const alpha = typeof value.alpha === 'number' ? value.alpha : 1;
  if (alpha >= 1 && typeof value.hex === 'string') {
    return shortenHex(value.hex);
  }
  if (Array.isArray(value.components) && value.components.length >= 3) {
    const [r, g, b] = value.components.map((c) => Math.round(c * 255));
    const pct = Math.round(alpha * 1000) / 10; // 0..100, one decimal
    const pctStr = Number.isInteger(pct) ? `${pct}%` : `${pct}%`;
    return `rgb(${r} ${g} ${b} / ${pctStr})`;
  }
  return value.hex ? shortenHex(value.hex) : 'inherit';
}

/**
 * Format a number leaf according to its path/category.
 */
function formatNumber(value, pathParts) {
  const [top, sub] = pathParts;
  const leafKey = pathParts[pathParts.length - 1];

  // Special: pill radius sentinel
  if (top === 'radius' && leafKey === 'full') return '9999px';

  if (top === 'typography') {
    if (TYPOGRAPHY_UNITLESS_KEYS.has(sub) || TYPOGRAPHY_UNITLESS_KEYS.has(leafKey)) {
      return String(value);
    }
    if (TYPOGRAPHY_PX_KEYS.has(sub) || TYPOGRAPHY_PX_KEYS.has(leafKey)) {
      return `${value}px`;
    }
    return String(value);
  }

  if (PX_CATEGORIES.has(top)) return `${value}px`;

  if (top === 'motion' && sub === 'duration') return `${value}ms`;

  // elevation, opacity, anything else: unitless
  return String(value);
}

function formatString(value, pathParts) {
  const v = String(value);
  // Quote font family names so stylelint doesn't flag value-keyword-case.
  const leafKey = pathParts[pathParts.length - 1];
  if (pathParts[0] === 'typography'
    && (pathParts[1] === 'family' || leafKey === 'fontFamily' || leafKey === 'family')) {
    return `'${v}'`;
  }
  return v;
}

function formatLeaf(node, pathParts) {
  switch (node.$type) {
    case 'color':
      return formatColor(node.$value);
    case 'number':
      return formatNumber(node.$value, pathParts);
    case 'string':
      return formatString(node.$value, pathParts);
    default:
      return String(node.$value);
  }
}

/**
 * Recursively walk the token tree, collecting { name, value, group } entries.
 * `group` is the top-level category for grouping output.
 */
function collect(node, pathParts, varPrefix, out) {
  if (!node || typeof node !== 'object') return;
  if (isLeaf(node)) {
    const name = pathToVarName(pathParts, varPrefix);
    const value = formatLeaf(node, pathParts);
    out.push({ name, value, group: pathParts[0] });
    return;
  }
  // Figma exports a `$root` key inside a group when that group itself has a
  // value AND children. Emit `$root` as a leaf at the parent path.
  if (node.$root && isLeaf(node.$root)) {
    const name = pathToVarName(pathParts, varPrefix);
    const value = formatLeaf(node.$root, pathParts);
    out.push({ name, value, group: pathParts[0] });
  }
  Object.keys(node)
    .filter((k) => !k.startsWith('$'))
    .forEach((key) => collect(node[key], [...pathParts, key], varPrefix, out));
}

function buildCss(entries, sourceLabel) {
  // Group by top-level category, preserve insertion order within group.
  const groups = new Map();
  entries.forEach((entry) => {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
  });

  const lines = [];
  lines.push('/*');
  lines.push(` * AUTO-GENERATED FROM ${sourceLabel}`);
  lines.push(' * Do not edit by hand. Run the build script to regenerate.');
  lines.push(' */');
  lines.push('');
  lines.push(':root {');

  let first = true;
  groups.forEach((items, group) => {
    if (!first) lines.push('');
    first = false;
    lines.push(`  /* ${group} */`);
    items.forEach(({ name, value }) => {
      lines.push(`  ${name}: ${value};`);
    });
  });

  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

async function loadEntries(jsonPath, varPrefix) {
  const raw = await readFile(jsonPath, 'utf8');
  const json = JSON.parse(raw);
  const entries = [];
  collect(json, [], varPrefix, entries);
  // De-duplicate (last wins) while preserving first-seen order.
  const seen = new Map();
  entries.forEach((entry) => {
    seen.set(entry.name, entry);
  });
  return [...seen.values()];
}

async function main() {
  // Build reference value -> var-name lookup, scoped per top-level category,
  // if a reference file was given. Scoping prevents cross-category matches
  // (e.g. unitless `16` from a font-weight matching `--opacity-16`).
  let lookup = null;
  if (referencePath) {
    const refEntries = await loadEntries(referencePath, '');
    lookup = new Map(); // group -> Map<value, varName>
    refEntries.forEach((entry) => {
      if (!lookup.has(entry.group)) lookup.set(entry.group, new Map());
      const groupMap = lookup.get(entry.group);
      if (!groupMap.has(entry.value)) groupMap.set(entry.value, entry.name);
    });
  }

  const entries = await loadEntries(inputPath, prefix);

  // Replace literal values with var(--reference) where possible.
  let referenced = 0;
  const finalEntries = entries.map((entry) => {
    if (!lookup) return entry;
    const groupMap = lookup.get(entry.group);
    if (!groupMap) return entry;
    const refName = groupMap.get(entry.value);
    if (refName && refName !== entry.name) {
      referenced += 1;
      return { ...entry, value: `var(${refName})` };
    }
    return entry;
  });

  const css = buildCss(finalEntries, inputArg);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, css, 'utf8');

  const refMsg = lookup ? ` (${referenced} referencing primitives)` : '';
  process.stdout.write(
    `Wrote ${finalEntries.length} CSS custom properties to ${outputArg}${refMsg}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`build-tokens failed: ${err.message}\n`);
  process.exit(1);
});
