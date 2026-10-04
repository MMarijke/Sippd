import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { postActivity } from '@/hooks/usePostActivity';
import { planUnlocks, summaryText } from '@/lib/achievementUnlocks';

const STORAGE_KEY = 'sippd_unlocked_achievements';
// Pre-rename key: read once so existing users keep what they've seen.
const LEGACY_KEY = 'canvolt_unlocked_achievements';
// Set once this device has evaluated achievements, even with none unlocked,
// so a brand-new collector isn't mistaken for a new device.
const INIT_KEY = 'sippd_achievements_initialized';
const DAY_MS = 86400000;

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function getStoredKeys() {
  const keys = readJson(STORAGE_KEY) ?? readJson(LEGACY_KEY) ?? [];
  return new Set(Array.isArray(keys) ? keys : []);
}

function isInitialized() {
  try {
    return localStorage.getItem(INIT_KEY) === '1' || localStorage.getItem(LEGACY_KEY) !== null;
  } catch {
    return false;
  }
}

function persist(keys) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
    localStorage.setItem(INIT_KEY, '1');
  } catch {
    // Not being able to store this only means a summary note next time.
  }
}

/**
 * Given the current list of computed achievements, detects newly unlocked
 * ones and decides how to announce them (see lib/achievementUnlocks.js):
 * a single unlock earned just now gets the full pop-up (returned as
 * `current`); a batch, or catch-up on a new device, gets one summary note
 * instead of a chain of full-screen pop-ups. New unlocks are posted to the
 * feed; catch-up on a new device isn't, since those were posted when earned.
 *
 * userCreatedAt: an account less than a day old counts as a known device, so
 * a new collector's first achievements (e.g. Early Adopter at sign-up) are
 * celebrated rather than summarised.
 */
export function useAchievementUnlock(achievements, userId, userCreatedAt) {
  const navigate = useNavigate();
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

    const newAccount = userCreatedAt && Date.now() - new Date(userCreatedAt).getTime() < DAY_MS;
    const plan = planUnlocks(achievements, seenRef.current, isInitialized() || !!newAccount);

    if (plan.fresh.length === 0) {
      // Still mark the device as evaluated, so its first real unlock later
      // is celebrated, not treated as catch-up.
      persist(seenRef.current);
      return;
    }

    const updated = new Set(seenRef.current);
    plan.fresh.forEach(a => updated.add(a.key));
    seenRef.current = updated;
    persist(updated);

    if (userId) {
      plan.post.forEach(a => {
        postActivity({
          user: { id: userId, full_name: profile?.full_name },
          type: 'achievement_unlocked',
          achievementData: a,
          isPrivate: profile?.is_private,
        }).catch(() => {});
      });
    }

    if (plan.summary.length > 0) {
      const { title, description } = summaryText(plan.summary);
      toast.success(title, {
        description,
        action: { label: 'View', onClick: () => navigate('/achievements') },
      });
    }
    if (plan.animate.length > 0) setQueue(prev => [...prev, ...plan.animate]);
  }, [achievements, userId, userCreatedAt, profile, profileLoading, navigate]);

  const dismissCurrent = () => {
    setQueue(prev => prev.slice(1));
  };

  return { current: queue[0] || null, dismissCurrent };
}
