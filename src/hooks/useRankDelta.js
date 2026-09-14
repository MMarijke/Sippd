import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY_PREFIX = 'sippd_rank_snapshot:';

// Compares the current rank against the rank last recorded for this exact
// metric+user, then overwrites storage with the new value — once per mount,
// so the delta reflects "since you last opened this page" rather than
// collapsing to 0 on every re-render. Client-side/per-device only (no
// cross-device sync); a real rank-history table would be the more robust
// version of this, but a per-device "since last visit" delta is real,
// useful signal without a migration. Rank 1 is best, so a positive delta
// (previous - current) means the rank improved (climbed).
export function useRankDelta(metricKey, currentRank, userId) {
  const [delta, setDelta] = useState(null);
  const recorded = useRef(false);

  useEffect(() => {
    if (!userId || !metricKey || !currentRank || currentRank <= 0) return;
    if (recorded.current) return;
    recorded.current = true;

    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    let snapshot = {};
    try {
      snapshot = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      snapshot = {};
    }

    const previousRank = snapshot[metricKey];
    if (typeof previousRank === 'number' && previousRank !== currentRank) {
      setDelta(previousRank - currentRank);
    }

    snapshot[metricKey] = currentRank;
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // Private-mode/quota failure — the delta just won't persist to the
      // next visit; not worth surfacing an error for a nice-to-have.
    }
  }, [metricKey, currentRank, userId]);

  return delta;
}
