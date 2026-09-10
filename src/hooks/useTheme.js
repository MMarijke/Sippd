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
export const THEMES = [
  { id: 'cyan', label: 'Signal Cyan', pro: false, swatch: '#00E5FF' },
  { id: 'common', label: 'Steel', pro: true, swatch: '#6B7280' },
  { id: 'uncommon', label: 'Verdant', pro: true, swatch: '#22C55E' },
  { id: 'rare', label: 'Cobalt', pro: true, swatch: '#3B82F6' },
  { id: 'ultra', label: 'Voidglass', pro: true, swatch: '#A855F7' },
  { id: 'legendary', label: 'Aurora', pro: true, swatch: '#EC4899' },
];

const DEFAULT_THEME = 'cyan';

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
      toast.error(
        error.message?.includes('Pro-only')
          ? 'That theme is a Pro perk — upgrade to unlock it.'
          : 'Failed to change theme'
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-theme', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-profile', user?.id] });
    },
  });

  return { theme, setTheme, isPending };
}
