import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// Keep in sync with the [data-theme="x"][data-polarity="y"] blocks in
// index.css and the profiles_theme_valid / profiles_theme_polarity_valid
// check constraints. Every theme id now has BOTH a dark and a light
// rendering (index.css's "-polarity counterparts" blocks) -- polarity is
// a second, independent axis (profiles.theme_polarity), not a doubling of
// theme ids. Each theme's `dark`/`light` sub-objects carry the exact hex
// this app actually renders for that combination (main color as `swatch`,
// --background as `background`) -- no separate "true" swatch color that
// differs from what ships; the picker preview always matches reality for
// whichever polarity is currently active.
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
      { id: 'xp-gold', label: 'XP Gold', pro: true,
        dark: { swatch: '#FFD43B', background: '#12100A' }, light: { swatch: '#968A2C', background: '#FEF9EC' } },
      { id: 'synthwave', label: 'Synthwave', pro: true,
        dark: { swatch: '#B93FE8', background: '#0D0718' }, light: { swatch: '#A569D3', background: '#F3ECFE' } },
    ],
  },
  {
    id: 'vintage-pastel',
    label: 'Vintage Pastel',
    isNew: true,
    themes: [
      { id: 'mint-fizz', label: 'Mint Fizz', pro: false,
        light: { swatch: '#4C9486', background: '#FFF8E9' }, dark: { swatch: '#1C9C82', background: '#151209' } },
      { id: 'strawberry-cream', label: 'Strawberry Cream', pro: true,
        light: { swatch: '#BF707E', background: '#FFF5F0' }, dark: { swatch: '#E25F5A', background: '#150D09' } },
      { id: 'blue-raspberry', label: 'Blue Raspberry', pro: true,
        light: { swatch: '#538EB9', background: '#F4FAFC' }, dark: { swatch: '#268ED9', background: '#091215' } },
      { id: 'lemon-pop', label: 'Lemon Pop', pro: true,
        light: { swatch: '#AF8133', background: '#FFFBEA' }, dark: { swatch: '#C37822', background: '#151309' } },
      { id: 'peach-soda', label: 'Peach Soda', pro: true,
        light: { swatch: '#C96E47', background: '#FFF5EC' }, dark: { swatch: '#DD693C', background: '#150F09' } },
      { id: 'grape-float', label: 'Grape Float', pro: true,
        light: { swatch: '#A874B4', background: '#FAF5FC' }, dark: { swatch: '#A46CE5', background: '#120915' } },
    ],
  },
];

// Flat list for anything that just needs to validate/iterate every theme id
// regardless of family (e.g. Settings' loading skeleton).
export const THEMES = THEME_FAMILIES.flatMap(f => f.themes);

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

  const { data } = useQuery({
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
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.polarity = polarity;

    // Mobile browser chrome (the address bar / status bar strip) doesn't
    // read CSS variables, so it has to be told the active background
    // directly, updated every time theme or polarity changes — a static
    // tag would leave it mismatched the moment anyone picks a different
    // theme or flips polarity, which is exactly where it'd be most
    // visibly wrong (a light polarity's near-white background under a
    // chrome bar left over from a dark one).
    const meta = document.querySelector('meta[name="theme-color"]');
    const match = THEMES.find(t => t.id === theme);
    if (meta && match) meta.setAttribute('content', match[polarity].background);
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

  return { theme, polarity, setTheme, setPolarity, isPending: isThemePending || isPolarityPending };
}
