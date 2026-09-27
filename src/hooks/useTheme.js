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
// color. Matches RARITY_HEX in rarityConsensus.js for the 5 rarity themes.
//
// Three families, six palettes each (1 free + 5 Pro per family, same split
// Neon Grid already used before the other two existed) — see index.css's
// own "Field Guide family"/"Origami Fold family" comment blocks for the
// font/glow/texture decisions each family makes once for all six of its
// palettes.
export const THEME_FAMILIES = [
  {
    id: 'neon-grid',
    label: 'Neon Grid',
    themes: [
      { id: 'cyan', label: 'Signal Cyan', pro: false, swatch: '#00E5FF' },
      { id: 'common', label: 'Steel', pro: true, swatch: '#6B7280' },
      { id: 'uncommon', label: 'Verdant', pro: true, swatch: '#22C55E' },
      { id: 'rare', label: 'Cobalt', pro: true, swatch: '#3B82F6' },
      { id: 'ultra', label: 'Voidglass', pro: true, swatch: '#9333EA' },
      { id: 'legendary', label: 'Aurora', pro: true, swatch: '#EC4899' },
    ],
  },
  {
    id: 'field-guide',
    label: 'Field Guide',
    // isNew drives a "New" badge on this tile in Settings until the user
    // has actually opened it once (see Settings.jsx's seenFamilies
    // tracking) — added after the launch made the two new families nearly
    // invisible to existing users, who default straight past the family
    // picker into whichever palette their theme already belongs to.
    // (/impeccable critique)
    isNew: true,
    themes: [
      { id: 'herbarium', label: 'Herbarium', pro: false, swatch: '#a68259' },
      { id: 'monarch', label: 'Monarch', pro: true, swatch: '#ed8326' },
      { id: 'morpho', label: 'Morpho', pro: true, swatch: '#0EA5B7' },
      { id: 'luna', label: 'Luna', pro: true, swatch: '#6EE7B7' },
      { id: 'cochineal', label: 'Cochineal', pro: true, swatch: '#d03952' },
      { id: 'hornet', label: 'Hornet', pro: true, swatch: '#f0b019' },
    ],
  },
  {
    id: 'origami-fold',
    label: 'Origami Fold',
    isNew: true,
    themes: [
      { id: 'washi', label: 'Washi', pro: false, swatch: '#D9CBA3' },
      { id: 'shu', label: 'Shu', pro: true, swatch: '#e5472e' },
      { id: 'ai', label: 'Ai', pro: true, swatch: '#5A6BCE' },
      { id: 'matcha', label: 'Matcha', pro: true, swatch: '#6daa41' },
      { id: 'ume', label: 'Ume', pro: true, swatch: '#C2469B' },
      { id: 'kohaku', label: 'Kohaku', pro: true, swatch: '#B8792B' },
    ],
  },
];

// Flat list for anything that just needs to validate/iterate every theme id
// regardless of family (e.g. Settings' loading skeleton).
export const THEMES = THEME_FAMILIES.flatMap(f => f.themes);

const DEFAULT_THEME = 'cyan';

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
 * anything but 'cyan' server-side, so this is the real gate — any
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
