import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// Keep in sync with index.css's [data-theme] blocks and the
// profiles_theme_valid / profiles_theme_polarity_valid check constraints.
// Each theme's `dark`/`light` sub-objects carry the exact hex this app
// actually renders for that combination (main color as `swatch`, supporting
// color as `sup`, --background as `background`) -- no separate "true"
// swatch color that differs from what ships. `sup` is Phase 2 only so far
// (an /impeccable critique found the picker's flat single-color swatches
// read as generic, especially with hue reuse across families — Phase 1's
// swatches stay flat pending the same treatment); Settings renders a
// two-tone gradient wherever `sup` exists and falls back to a flat fill
// otherwise.
//
// Neon Arcade (Phase 1; Vintage Pastel, XP Gold and Champagne were retired
// in 20260929000000_trim_theme_catalogue.sql) themes have BOTH `dark` and
// `light` -- index.css keys their CSS on [data-theme="x"][data-polarity="y"],
// and profiles.theme_polarity is a real, user-toggleable second axis for
// them. Phase 2 (Cosmic, Botanical, Noir, Candy) themes have only ONE of
// `dark`/`light` -- confirmed explicitly: each is a single fixed-polarity
// identity (Botanical's Sage is light, Forest is dark, etc., by design,
// not a preference), index.css keys their CSS on plain [data-theme="x"]
// with no [data-polarity] dependency at all, and the toggle simply doesn't
// render for these families (see familyHasPolarityToggle below) -- use
// getThemeSwatch()/getThemeBackground() rather than indexing `theme[polarity]`
// directly, since that key may not exist for a Phase 2 theme.
export const THEME_FAMILIES = [
  {
    id: 'neon-arcade',
    label: 'Neon Arcade',
    themes: [
      { id: 'power-up', label: 'Power-Up', pro: false,
        dark: { swatch: '#00FF87', background: '#0B1018' }, light: { swatch: '#2C9664', background: '#ECF2FE' } },
      { id: 'cyberpunk', label: 'Cyberpunk', pro: true,
        dark: { swatch: '#FF2BD6', background: '#100914' }, light: { swatch: '#CD51B4', background: '#F7ECFE' } },
      { id: 'plasma', label: 'Plasma', pro: true,
        dark: { swatch: '#00E5FF', background: '#071016' }, light: { swatch: '#2E939E', background: '#ECF7FE' } },
      { id: 'boss-fight', label: 'Boss Fight', pro: true,
        dark: { swatch: '#FF3864', background: '#12090C' }, light: { swatch: '#CF598C', background: '#FEECF1' } },
      { id: 'synthwave', label: 'Synthwave', pro: true,
        dark: { swatch: '#B93FE8', background: '#0D0718' }, light: { swatch: '#A569D3', background: '#F3ECFE' } },
    ],
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    isNew: true,
    themes: [
      { id: 'moonlight', label: 'Moonlight', pro: false, dark: { swatch: '#B3BCCD', sup: '#7183AA', background: '#101522' } },
      { id: 'nebula', label: 'Nebula', pro: true, dark: { swatch: '#7A5FFF', sup: '#5579E8', background: '#130B20' } },
      { id: 'solar-flare', label: 'Solar Flare', pro: true, dark: { swatch: '#FF7043', sup: '#FFB347', background: '#1A0D08' } },
      { id: 'aurora', label: 'Aurora', pro: true, dark: { swatch: '#45E0B0', sup: '#6875FF', background: '#081716' } },
      { id: 'deep-space', label: 'Deep Space', pro: true, dark: { swatch: '#5269C9', sup: '#3655E3', background: '#080C1C' } },
      { id: 'stellar-gold', label: 'Stellar Gold', pro: true, dark: { swatch: '#E4C76A', sup: '#A98F45', background: '#17140B' } },
    ],
  },
  {
    id: 'botanical',
    label: 'Botanical',
    isNew: true,
    themes: [
      { id: 'sage', label: 'Sage', pro: false, light: { swatch: '#628B66', sup: '#3E5140', background: '#F4F0E5' } },
      { id: 'forest', label: 'Forest', pro: true, dark: { swatch: '#3E765B', sup: '#107848', background: '#0D1712' } },
      { id: 'fern', label: 'Fern', pro: true, dark: { swatch: '#68A86D', sup: '#447547', background: '#0F1911' } },
      { id: 'moss', label: 'Moss', pro: true, light: { swatch: '#828355', sup: '#5A5B37', background: '#F0EFE1' } },
      { id: 'terracotta', label: 'Terracotta', pro: true, dark: { swatch: '#AF4B3C', sup: '#967948', background: '#1D120D' } },
      { id: 'meadow', label: 'Meadow', pro: true, light: { swatch: '#549135', sup: '#2C491F', background: '#F5F3DE' } },
    ],
  },
  {
    id: 'noir',
    label: 'Noir',
    isNew: true,
    themes: [
      { id: 'carbon', label: 'Carbon', pro: false, dark: { swatch: '#6F7378', sup: '#4D698B', background: '#111214' } },
      { id: 'crimson', label: 'Crimson', pro: true, dark: { swatch: '#B83A4B', sup: '#8A5760', background: '#160B0E' } },
      { id: 'amethyst', label: 'Amethyst', pro: true, dark: { swatch: '#8E6DAB', sup: '#8B3DCB', background: '#120D16' } },
      { id: 'sapphire', label: 'Sapphire', pro: true, dark: { swatch: '#527BB9', sup: '#1961CC', background: '#080F19' } },
      { id: 'emerald', label: 'Emerald', pro: true, dark: { swatch: '#458584', sup: '#0A754D', background: '#09130F' } },
      { id: 'silver-screen', label: 'Silver Screen', pro: true, dark: { swatch: '#F2F2F2', sup: '#B8B8B8', background: '#0A0A0A' } },
    ],
  },
  {
    id: 'candy',
    label: 'Candy',
    isNew: true,
    themes: [
      { id: 'bubblegum', label: 'Bubblegum', pro: false, light: { swatch: '#FF1F76', sup: '#B91D59', background: '#FFF3F8' } },
      { id: 'blue-pop', label: 'Blue Pop', pro: true, light: { swatch: '#3582FF', sup: '#255FBD', background: '#F0FAFF' } },
      { id: 'grape-candy', label: 'Grape Candy', pro: true, light: { swatch: '#A65BFF', sup: '#7637CE', background: '#F8F1FF' } },
      { id: 'orange-crush', label: 'Orange Crush', pro: true, light: { swatch: '#EA5300', sup: '#953A11', background: '#FFF5ED' } },
      { id: 'sour-apple', label: 'Sour Apple', pro: true, light: { swatch: '#679616', sup: '#2B4213', background: '#F5FFE9' } },
      { id: 'cherry-pop', label: 'Cherry Pop', pro: true, light: { swatch: '#FF2743', sup: '#B4243A', background: '#FFF1F3' } },
    ],
  },
];

// Flat list for anything that just needs to validate/iterate every theme id
// regardless of family (e.g. Settings' loading skeleton).
export const THEMES = THEME_FAMILIES.flatMap(f => f.themes);

// A theme's rendering for a given polarity, falling back to whichever
// polarity it actually has when the requested one doesn't exist (every
// Phase 2 theme only has one). Prefer this over `theme[polarity]` directly.
export function getThemeRendering(theme, polarity) {
  return theme?.[polarity] ?? theme?.dark ?? theme?.light ?? null;
}

// The tone that actually renders, which is what [data-tone] carries -- not
// always the stored polarity: a fixed-polarity Phase 2 theme (Sage is
// light, Forest is dark) ignores the stored value entirely. Falls back to
// 'dark' for an unknown id, matching :root's dark default.
export function getRenderedTone(theme, polarity) {
  if (theme?.[polarity]) return polarity;
  if (theme?.dark) return 'dark';
  if (theme?.light) return 'light';
  return 'dark';
}

export function getThemeFamily(themeId) {
  return THEME_FAMILIES.find(f => f.themes.some(t => t.id === themeId)) ?? null;
}

// Each family's font trio (must match the --font-* vars its index.css
// block sets). Neon Arcade has no entry: it's :root's default, loaded by
// index.css's own @import for every visitor. The rest load on demand the
// first time their family is applied, so a user only ever downloads the
// one trio they actually see (/impeccable audit).
export const FAMILY_FONT_URLS = {
  cosmic: 'https://fonts.googleapis.com/css2?family=Michroma&family=Space+Mono:wght@400;700&family=Manrope:wght@400;500;700&display=swap',
  botanical: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Karla:wght@400;500;700&display=swap',
  noir: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@500;700&family=Fragment+Mono&family=Jost:wght@400;500&display=swap',
  candy: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Chivo+Mono:wght@400;500&family=Nunito:wght@400;600;700&display=swap',
};

// Appends the family's stylesheet once; later calls for the same family
// are no-ops, so switching back and forth never duplicates the <link>.
function ensureFamilyFonts(familyId) {
  const href = FAMILY_FONT_URLS[familyId];
  if (!href) return;
  const id = `family-fonts-${familyId}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// The polarity toggle only makes sense for a family where every theme
// genuinely has both renderings -- a family with any single-polarity theme
// (Botanical, or any Phase 2 family) never shows it, since toggling
// wouldn't change anything for at least one of its palettes.
export function familyHasPolarityToggle(family) {
  return !!family?.themes.every(t => t.dark && t.light);
}

const DEFAULT_THEME = 'power-up';
// Matches profiles.theme_polarity's own column default -- keeping these
// two in sync is what stops a fresh signup from rendering as an
// accidental mismatch (power-up's dark palette read with a stray light
// flag before its first profile fetch resolves).
const DEFAULT_POLARITY = 'dark';

/**
 * Picks the toast copy for a failed theme change. Split out as its own
 * function purely so it's unit-testable without jsdom/@testing-library —
 * the rest of setTheme's behavior (optimistic cache update + rollback)
 * lives inside react-query's own hook lifecycle and isn't practical to
 * test the same way without them (see useTheme.test.js).
 *
 * The 'Pro-only' substring match is deliberately loose, not an error-code
 * check — it has to match profiles_lock_columns()'s exact RAISE EXCEPTION
 * text ('theme is Pro-only — upgrade to unlock',
 * 20260909000000_add_profile_theme.sql), which is the only signal this
 * client has for *why* the update was rejected.
 */
export function getThemeChangeErrorMessage(error) {
  return error?.message?.includes('Pro-only')
    ? 'That theme is a Pro perk — upgrade to unlock it.'
    : 'Failed to change theme';
}

/**
 * Reads and applies the current user's theme + polarity (via [data-theme]
 * and [data-polarity] on <html>, so every page reskins from CSS variables
 * alone — no per-component changes) and exposes setTheme()/setPolarity()
 * to change them independently. Polarity is NOT Pro-gated server-side —
 * profiles_lock_columns()'s Pro-lock already covers theme id itself (a
 * free user still can't set theme to 'cyberpunk' regardless of polarity),
 * so which rendering of an already-legitimate theme id you see is a plain
 * cosmetic preference, same trust level as any other client-writable
 * column. The theme id write still goes through the real gate; any
 * client-side lock in the picker UI is just avoiding an unnecessary round
 * trip, never the enforcement itself.
 */
export function useTheme() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading: isThemeLoading } = useQuery({
    queryKey: ['my-theme', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme, theme_polarity')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return {
        theme: data.theme || DEFAULT_THEME,
        polarity: data.theme_polarity || DEFAULT_POLARITY,
      };
    },
    enabled: !!user?.id,
  });
  const theme = data?.theme ?? DEFAULT_THEME;
  const polarity = data?.polarity ?? DEFAULT_POLARITY;

  useEffect(() => {
    const match = THEMES.find(t => t.id === theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.polarity = polarity;
    document.documentElement.dataset.tone = getRenderedTone(match, polarity);
    ensureFamilyFonts(getThemeFamily(theme)?.id);

    // Mobile browser chrome (the address bar / status bar strip) doesn't
    // read CSS variables, so it has to be told the active background
    // directly, updated every time theme or polarity changes — a static
    // tag would leave it mismatched the moment anyone picks a different
    // theme or flips polarity, which is exactly where it'd be most
    // visibly wrong (a light polarity's near-white background under a
    // chrome bar left over from a dark one).
    const meta = document.querySelector('meta[name="theme-color"]');
    const rendering = getThemeRendering(match, polarity);
    if (meta && rendering) meta.setAttribute('content', rendering.background);
  }, [theme, polarity]);

  const { mutate: setTheme, isPending: isThemePending } = useMutation({
    mutationFn: async (nextTheme) => {
      const { error } = await supabase
        .from('profiles')
        .update({ theme: nextTheme })
        .eq('id', user.id);
      if (error) throw error;
      return nextTheme;
    },
    onMutate: async (nextTheme) => {
      await queryClient.cancelQueries({ queryKey: ['my-theme', user?.id] });
      const previous = queryClient.getQueryData(['my-theme', user?.id]);
      queryClient.setQueryData(['my-theme', user?.id], old => ({ ...old, theme: nextTheme }));
      return { previous };
    },
    onError: (error, _nextTheme, context) => {
      if (context?.previous) queryClient.setQueryData(['my-theme', user?.id], context.previous);
      toast.error(getThemeChangeErrorMessage(error));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-theme', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-profile', user?.id] });
    },
  });

  const { mutate: setPolarity, isPending: isPolarityPending } = useMutation({
    mutationFn: async (nextPolarity) => {
      const { error } = await supabase
        .from('profiles')
        .update({ theme_polarity: nextPolarity })
        .eq('id', user.id);
      if (error) throw error;
      return nextPolarity;
    },
    onMutate: async (nextPolarity) => {
      await queryClient.cancelQueries({ queryKey: ['my-theme', user?.id] });
      const previous = queryClient.getQueryData(['my-theme', user?.id]);
      queryClient.setQueryData(['my-theme', user?.id], old => ({ ...old, polarity: nextPolarity }));
      return { previous };
    },
    onError: (error, _nextPolarity, context) => {
      if (context?.previous) queryClient.setQueryData(['my-theme', user?.id], context.previous);
      toast.error('Failed to change light/dark mode');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-theme', user?.id] });
    },
  });

  return { theme, polarity, setTheme, setPolarity, isThemeLoading, isPending: isThemePending || isPolarityPending };
}
