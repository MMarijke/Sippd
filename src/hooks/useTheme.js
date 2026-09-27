import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// Keep in sync with the [data-theme="x"] blocks in index.css and the
// profiles_theme_valid check constraint. `swatch` is each theme's --primary
// as a static hex, purely for the picker preview — the active theme's own
// CSS variables only describe *one* theme at a time, so a swatch can't be
// drawn from var(--primary) directly without every dot showing the same
// color. `background` is that theme's --background hex, used only to set
// the <meta name="theme-color"> tag (see the effect below) — browser chrome
// can't read a CSS variable either, so this is the one other place a raw
// hex has to be duplicated outside index.css.
//
// Phase 1: two families, six palettes each (1 free + 5 Pro per family).
// Vintage Pastel's main/supporting are deliberately NOT the pale pastel
// hex first proposed for this family — those failed background-vs-main
// contrast (as low as 1.36:1) because main/supporting render bare (icon,
// stat number, link, label) directly on --background at 120+ call sites
// app-wide, not just inside a filled chip. Every value below is exactly
// what's live in index.css — the swatch shows the same color the rest of
// the app renders, not a separate "true pastel" preview.
export const THEME_FAMILIES = [
  {
    id: 'neon-arcade',
    label: 'Neon Arcade',
    themes: [
      { id: 'power-up', label: 'Power-Up', pro: false, swatch: '#00FF87', background: '#0B1018' },
      { id: 'cyberpunk', label: 'Cyberpunk', pro: true, swatch: '#FF2BD6', background: '#100914' },
      { id: 'plasma', label: 'Plasma', pro: true, swatch: '#00E5FF', background: '#071016' },
      { id: 'boss-fight', label: 'Boss Fight', pro: true, swatch: '#FF3864', background: '#12090C' },
      { id: 'xp-gold', label: 'XP Gold', pro: true, swatch: '#FFD43B', background: '#12100A' },
      { id: 'synthwave', label: 'Synthwave', pro: true, swatch: '#B93FE8', background: '#0D0718' },
    ],
  },
  {
    id: 'vintage-pastel',
    label: 'Vintage Pastel',
    isNew: true,
    themes: [
      { id: 'mint-fizz', label: 'Mint Fizz', pro: false, swatch: '#4C9486', background: '#FFF8E9' },
      { id: 'strawberry-cream', label: 'Strawberry Cream', pro: true, swatch: '#BF707E', background: '#FFF5F0' },
      { id: 'blue-raspberry', label: 'Blue Raspberry', pro: true, swatch: '#538EB9', background: '#F4FAFC' },
      { id: 'lemon-pop', label: 'Lemon Pop', pro: true, swatch: '#AF8133', background: '#FFFBEA' },
      { id: 'peach-soda', label: 'Peach Soda', pro: true, swatch: '#C96E47', background: '#FFF5EC' },
      { id: 'grape-float', label: 'Grape Float', pro: true, swatch: '#A874B4', background: '#FAF5FC' },
    ],
  },
];

// Flat list for anything that just needs to validate/iterate every theme id
// regardless of family (e.g. Settings' loading skeleton).
export const THEMES = THEME_FAMILIES.flatMap(f => f.themes);

const DEFAULT_THEME = 'power-up';

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
 * Reads and applies the current user's theme (via [data-theme] on <html>,
 * so every page reskins from CSS variables alone — no per-component
 * changes) and exposes setTheme() to change it. The write goes straight to
 * profiles.theme; profiles_lock_columns() rejects a non-Pro user setting
 * anything but a free theme server-side, so this is the real gate — any
 * client-side lock in the picker UI is just avoiding an unnecessary round
 * trip, never the enforcement itself.
 */
export function useTheme() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: theme = DEFAULT_THEME } = useQuery({
    queryKey: ['my-theme', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data.theme || DEFAULT_THEME;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    // Mobile browser chrome (the address bar / status bar strip) doesn't
    // read CSS variables, so it has to be told the active background
    // directly, updated every time the theme changes — a static tag would
    // leave it mismatched the moment anyone picks a different theme, which
    // is exactly where it'd be most visibly wrong (Vintage Pastel's light
    // background under a chrome bar left over from a dark theme).
    const meta = document.querySelector('meta[name="theme-color"]');
    const match = THEMES.find(t => t.id === theme);
    if (meta && match) meta.setAttribute('content', match.background);
  }, [theme]);

  const { mutate: setTheme, isPending } = useMutation({
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
      queryClient.setQueryData(['my-theme', user?.id], nextTheme);
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

  return { theme, setTheme, isPending };
}
