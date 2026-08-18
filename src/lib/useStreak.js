import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

function toDateStr(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * On mount, compares today vs user.last_active_date:
 *  - Same day → streak unchanged
 *  - Yesterday → streak + 1, update last_active_date
 *  - Older / missing → reset to 1, update last_active_date
 * Returns the current streak value (number).
 */
export function useStreak() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const user = await base44.auth.me();
      const today = toDateStr(new Date());
      const last = user.last_active_date;
      const current = user.current_streak || 0;

      let newStreak = current;

      if (!last) {
        // First ever open
        newStreak = 1;
      } else if (last === today) {
        // Already updated today — nothing to do
        newStreak = current;
      } else {
        // Check if last was yesterday
        const yesterday = toDateStr(new Date(Date.now() - 86400000));
        if (last === yesterday) {
          newStreak = current + 1;
        } else {
          // Missed a day — reset
          newStreak = 1;
        }
      }

      if (!cancelled) setStreak(newStreak);

      // Persist if date changed
      if (last !== today) {
        await base44.auth.updateMe({ last_active_date: today, current_streak: newStreak });
      }
    }

    tick();
    return () => { cancelled = true; };
  }, []);

  return streak;
}