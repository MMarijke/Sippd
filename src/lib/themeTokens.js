// Resolves each theme rendering's CSS tokens the way the browser does for
// <html>, from index.css and useTheme.js source text. Test/tooling only (it
// takes file contents, so it never runs in the app): shared by
// navActiveTab.test.js and themeDistance.test.js.
//
// Cascade: :root defaults, then [data-theme] blocks, then
// [data-theme][data-polarity] blocks (more specific); later rules win ties;
// var(--x) references are followed. Selectors with other attributes
// (data-tone, data-rarity) or classes are ignored: they don't set the
// theme's base tokens. Many themes inherit tokens from :root (e.g. most dark
// themes' --muted-foreground), which reading a theme's own block would miss.

// The renderings in THEME_FAMILIES: one per theme and polarity it defines
// (33 themes; Neon Arcade's 5 in both polarities = 38).
export function themeRenderings(useThemeSource) {
  const familiesSrc = useThemeSource.slice(
    useThemeSource.indexOf('export const THEME_FAMILIES'),
    useThemeSource.indexOf('export const THEMES'),
  );
  return familiesSrc
    .split("{ id: '")
    .slice(1)
    .flatMap((chunk) => {
      const id = chunk.slice(0, chunk.indexOf("'"));
      const polarities = ['dark', 'light'].filter((p) => new RegExp(`\\b${p}: \\{`).test(chunk));
      return polarities.map((polarity) => ({ id, polarity }));
    });
}

export function cssRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectorText, body], order) => ({
    selectors: selectorText.split(',').map((s) => s.trim()),
    decls: Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])),
    order,
  }));
}

// Specificity of a selector that applies to <html> for this rendering, or -1.
function specificity(selector, { id, polarity }) {
  const m = selector.match(/^(:root)?((?:\[data-(?:theme|polarity)="[^"]+"\])*)$/);
  if (!m || (!m[1] && !m[2])) return -1;
  const attrs = [...m[2].matchAll(/\[data-(theme|polarity)="([^"]+)"\]/g)];
  const ok = attrs.every(([, key, value]) => (key === 'theme' ? value === id : value === polarity));
  return ok ? (m[1] ? 1 : 0) + attrs.length : -1;
}

// Returns get(tokenName) -> the resolved value (e.g. "217 37% 7%").
export function resolveTokens(rules, rendering) {
  const applied = rules
    .flatMap((r) => r.selectors.map((s) => ({ spec: specificity(s, rendering), r })))
    .filter((x) => x.spec >= 0)
    .sort((a, b) => a.spec - b.spec || a.r.order - b.r.order);
  const tokens = {};
  for (const { r } of applied) Object.assign(tokens, r.decls);
  const get = (name, depth = 0) => {
    const v = tokens[name];
    const ref = v?.match(/^var\((--[\w-]+)\)$/);
    return ref && depth < 10 ? get(ref[1], depth + 1) : v;
  };
  return get;
}
