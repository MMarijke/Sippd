import { useState, useEffect, useRef } from 'react';

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
 * and returns a queue + dismiss handler for the animation.
 */
export function useAchievementUnlock(achievements) {
  const [queue, setQueue] = useState([]); // achievements waiting to animate
  const seenRef = useRef(getStoredKeys());

  useEffect(() => {
    if (!achievements || achievements.length === 0) return;

    const newlyUnlocked = achievements.filter(
      a => a.unlocked && !seenRef.current.has(a.key)
    );

    if (newlyUnlocked.length === 0) return;

    // Persist so we don't re-fire on next render
    const updated = new Set(seenRef.current);
    newlyUnlocked.forEach(a => updated.add(a.key));
    seenRef.current = updated;
    saveKeys(updated);

    setQueue(prev => [...prev, ...newlyUnlocked]);
  }, [achievements]);

  const dismissCurrent = () => {
    setQueue(prev => prev.slice(1));
  };

  return { current: queue[0] || null, dismissCurrent };
}