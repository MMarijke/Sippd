import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeRenderings, cssRules, resolveTokens } from './themeTokens';

// Families differ by more than colour (2026-10-26, /impeccable bolder): each
// sets its own corners (--radius-scale), card lift (--card-lift) and number
// face (--font-num) in index.css, alongside border weight, texture and glow.
// These checks keep that true as themes are added: every theme carries its
// family's structure, no two families share corners or a number face, and
// every texture is a PNG tile (Android's WebView corrupts SVG-filter tiles,
// the Silver Screen bug).

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const source = read('../hooks/useTheme.js');
const rules = cssRules(read('../index.css'));

// theme id -> family id, from THEME_FAMILIES: a family is `id: '...'` on its
// own line, its themes the `{ id: '...'` entries that follow it.
const families = source.slice(source.indexOf('export const THEME_FAMILIES'), source.indexOf('export const THEMES'));
const familyOf = {};
let current = null;
for (const [, familyId, themeId] of families.matchAll(/\n\s+id: '([^']+)'|\{ id: '([^']+)'/g)) {
  if (familyId) current = familyId;
  else familyOf[themeId] = current;
}

const renderings = themeRenderings(source).map((r) => ({
  ...r,
  family: familyOf[r.id],
  get: resolveTokens(rules, r),
}));
// Not Object.groupBy: CI runs Node 20, which doesn't have it.
const byFamily = {};
for (const r of renderings) (byFamily[r.family] ??= []).push(r);
const STRUCTURE = ['--radius-scale', '--card-lift', '--font-num'];

describe('per-family structure', () => {
  it('finds every family and rendering', () => {
    expect(renderings).toHaveLength(46);
    expect(Object.keys(byFamily)).toHaveLength(9);
    expect(renderings.every((r) => r.family)).toBe(true);
  });

  it.each(Object.entries(byFamily))('%s: every theme shares the family structure', (_, members) => {
    for (const token of STRUCTURE) {
      const values = new Set(members.map((r) => r.get(token)));
      expect(values.size, `${token}: ${[...values].join(' | ')}`).toBe(1);
    }
  });

  it.each(['--radius-scale', '--font-num'])('no two families share %s', (token) => {
    const values = Object.values(byFamily).map((members) => members[0].get(token));
    expect(new Set(values).size).toBe(values.length);
  });

  it('every family sets its own structure (none falls back to the defaults)', () => {
    for (const [family, [r]] of Object.entries(byFamily)) {
      expect(r.get('--font-num'), family).not.toBe('var(--font-mono)');
    }
  });

  it.each(renderings.map((r) => [`${r.id} (${r.polarity})`, r]))('%s: card texture is none or a PNG tile', (_, r) => {
    const texture = r.get('--card-texture');
    // cssRules stops a value at its first ';', so a data URI reads as its prefix.
    expect(['none', 'url("data:image/png']).toContain(texture);
  });
});
