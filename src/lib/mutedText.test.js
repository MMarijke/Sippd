import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeRenderings, cssRules, resolveTokens } from './themeTokens';
import { contrast, hslToRgb, parseHsl } from './rampColour';

// Muted text (labels, captions, inactive tabs) in every theme:
// - every theme sets its own. Dark themes used to inherit :root's
//   blue-grey, which read bluish on warm and neutral pages (Carbon, Solar
//   Flare, Crimson); /impeccable polish, 2026-10-26.
// - it reads on every surface it sits on: the page, cards, and the --muted
//   fill (tab bars, chips), where 11 light themes were under 4.5:1.

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const css = read('../index.css');
const rules = cssRules(css);
const rootMuted = rules.find((r) => r.selectors.includes(':root') && r.decls['--muted-foreground'])
  .decls['--muted-foreground'];
const rgb = (hsl) => hslToRgb(parseHsl(hsl));

const cases = themeRenderings(read('../hooks/useTheme.js')).map((r) => [`${r.id} (${r.polarity})`, resolveTokens(rules, r)]);

describe('muted text', () => {
  it.each(cases)('%s sets its own muted text colour', (_, get) => {
    expect(get('--muted-foreground')).not.toBe(rootMuted);
  });

  it.each(cases)('%s muted text clears 4.5:1 on the page, cards and muted fills', (_, get) => {
    const text = rgb(get('--muted-foreground'));
    for (const surface of ['--background', '--card', '--muted']) {
      expect(contrast(text, rgb(get(surface))), surface).toBeGreaterThanOrEqual(4.5);
    }
  });
});
