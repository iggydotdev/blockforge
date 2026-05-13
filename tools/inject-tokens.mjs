#!/usr/bin/env node
/**
 * Inject the generated token files (styles/variables.css and styles/semantic.css)
 * into styles/styles.css between the marker comments:
 *
 *   /* tokens:start ... *\/
 *   /* tokens:end *\/
 *
 * Idempotent: running twice produces no diff.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, '..');

const STYLES_PATH = resolve(repoRoot, 'styles/styles.css');
const PRIMITIVES_PATH = resolve(repoRoot, 'styles/variables.css');
const SEMANTICS_PATH = resolve(repoRoot, 'styles/semantic.css');

const START_MARKER = '/* tokens:start';
const END_MARKER = '/* tokens:end */';

/**
 * Strip the leading "AUTO-GENERATED FROM ..." banner comment block from a
 * generated token file, returning the remainder (which begins with `:root {`).
 */
function stripBanner(css) {
  const trimmed = css.replace(/^\uFEFF/, '');
  const match = trimmed.match(/^\s*\/\*[\s\S]*?\*\/\s*/);
  return match ? trimmed.slice(match[0].length) : trimmed;
}

/**
 * Extract the property declarations from inside a generated `:root { ... }`
 * block, returning the inner body without the wrapping selector or braces.
 */
function extractRootBody(css) {
  const stripped = stripBanner(css);
  const open = stripped.indexOf('{');
  const close = stripped.lastIndexOf('}');
  if (open === -1 || close === -1 || close < open) {
    throw new Error('expected a :root { ... } block in generated token file');
  }
  return stripped.slice(open + 1, close).replace(/^\n+|\n+$/g, '');
}

async function main() {
  const [stylesRaw, primitivesRaw, semanticsRaw] = await Promise.all([
    readFile(STYLES_PATH, 'utf8'),
    readFile(PRIMITIVES_PATH, 'utf8'),
    readFile(SEMANTICS_PATH, 'utf8'),
  ]);

  const startIdx = stylesRaw.indexOf(START_MARKER);
  const endIdx = stylesRaw.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    process.stderr.write(
      'inject-tokens: missing markers in styles/styles.css. '
      + `Add\n  ${START_MARKER} ... */\n  ${END_MARKER}\n`,
    );
    process.exit(1);
  }

  // Preserve the start marker line as-is (up to and including its closing */).
  const startLineEnd = stylesRaw.indexOf('*/', startIdx);
  if (startLineEnd === -1) {
    process.stderr.write('inject-tokens: malformed tokens:start marker.\n');
    process.exit(1);
  }
  const before = stylesRaw.slice(0, startLineEnd + 2);
  const after = stylesRaw.slice(endIdx);

  const primitives = extractRootBody(primitivesRaw);
  const semantics = extractRootBody(semanticsRaw);

  const injected = [
    before,
    '',
    primitives,
    '',
    semantics,
    '',
    '  ',
  ].join('\n') + after;

  if (injected === stylesRaw) {
    process.stdout.write('inject-tokens: styles.css already up to date\n');
    return;
  }

  await writeFile(STYLES_PATH, injected, 'utf8');
  process.stdout.write('inject-tokens: updated styles/styles.css\n');
}

main().catch((err) => {
  process.stderr.write(`inject-tokens failed: ${err.message}\n`);
  process.exit(1);
});
