import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { postActivity } from '@/hooks/usePostActivity';

const STORAGE_KEY = 'canvolt_unlocked_achievements';

function getStoredKeys() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveKeys(keys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
}

/**
 * Given the current list of computed achievements, detects newly unlocked ones
 * and returns a queue + dismiss handler for the animation. Also posts each
 * newly unlocked achievement to activity_items so it shows up in the Feed --
 * previously nothing did (see usePostActivity.js). userId is needed to fetch
 * the caller's own full_name/is_private for the post; a failure there never
 * blocks the animation queue itself (achievements have no server-side
 * representation to keep in sync, so this is a best-effort cosmetic post).
 *
 * Known limitation: unlock detection is a per-device localStorage diff, so
 * switching devices or clearing storage can post an already-unlocked
 * achievement again -- the same pre-existing imperfection the toast/animation
 * itself already has, not a new regression.
 */
export function useAchievementUnlock(achievements, userId) {
  const [queue, setQueue] = useState([]); // achievements waiting to animate
  const seenRef = useRef(getStoredKeys());

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile-privacy', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, is_private')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!achievements || achievements.length === 0) return;
    // Wait for the privacy lookup to settle (success or failure) before
    // marking anything as seen -- acting on a still-in-flight query would
    // permanently post/skip with the wrong (default) is_private, since
    // already-seen keys never get a second chance once saved.
    if (userId && profileLoading) return;

    const newlyUnlocked = achievements.filter(
      a => a.unlocked && !seenRef.current.has(a.key)
    );

    if (newlyUnlocked.length === 0) return;

    // Persist so we don't re-fire on next render
    const updated = new Set(seenRef.current);
    newlyUnlocked.forEach(a => updated.add(a.key));
    seenRef.current = updated;
    saveKeys(updated);

    if (userId) {
      newlyUnlocked.forEach(a => {
        postActivity({
          user: { id: userId, full_name: profile?.full_name },
          type: 'achievement_unlocked',
          achievementData: a,
          isPrivate: profile?.is_private,
        }).catch(() => {});
      });
    }

    setQueue(prev => [...prev, ...newlyUnlocked]);
  }, [achievements, userId, profile, profileLoading]);

  const dismissCurrent = () => {
    setQueue(prev => prev.slice(1));
  };

  return { current: queue[0] || null, dismissCurrent };
}
