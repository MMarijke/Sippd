import { useCallback, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const HIGHLIGHT_MS = 1500;

/**
 * Scroll a target row into view and briefly highlight it — shared by
 * CollectorsLeaderboard and RegionalLeaderboard's "Your Rank" banners
 * (/impeccable critique: the banner announced a rank number with no way
 * to act on it). Attach `targetRef` to the row you want to jump to (only
 * one row should ever hold it at a time); call `jumpToTarget()` from the
 * banner's onClick. Returns false when there's nothing to scroll to yet
 * (e.g. the target isn't rendered because it's outside the fetched top
 * 50), so the caller can fall back to an explanatory toast instead of a
 * silent no-op tap.
 */
export function useJumpToHighlight() {
  const targetRef = useRef(null);
  const [highlighted, setHighlighted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const timeoutRef = useRef(null);

  const jumpToTarget = useCallback(() => {
    if (!targetRef.current) return false;
    targetRef.current.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    // Move focus too, so a keyboard or screen-reader user lands on the row
    // they were sent to instead of staying on the button. The row needs
    // tabIndex={-1}.
    targetRef.current.focus({ preventScroll: true });
    clearTimeout(timeoutRef.current);
    setHighlighted(true);
    timeoutRef.current = setTimeout(() => setHighlighted(false), HIGHLIGHT_MS);
    return true;
  }, [reducedMotion]);

  return { targetRef, highlighted, jumpToTarget };
}
