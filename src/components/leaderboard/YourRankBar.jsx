import { useEffect, useState } from 'react';
import { ArrowDownToLine, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Your standing, pinned just above the bottom nav while you scroll: the one
// number people open Ranks for, in thumb reach, with the gap to the next
// collector up. It used to be a 44px strip in the sixth slot of the control
// stack, whose aria-label also hid the rank from screen readers
// (/impeccable critique). It steps aside while your own row is on screen,
// since the row already says the same thing.
//
// status: 'ranked' | 'unranked' | 'loading' | 'error'
// scope: what the rank is measured by ("by Score", "in Cape Town").
// rival: { name, gap } for the collector directly above, or null at #1.
// unit: the gap's plural unit ("pts", "cans", "rare pulls").
export default function YourRankBar({ status, rank, scope, rival, unit, rankDelta, rowRef, onJump }) {
  const rowVisible = useOnScreen(rowRef, status === 'ranked');

  const rankText = status === 'ranked' ? `#${rank}`
    : status === 'loading' ? '…'
    : status === 'error' ? 'Unavailable'
    : 'Not ranked yet';

  const gapText = status !== 'ranked' ? null
    // unit is plural ("pts", "rare pulls"); one of them drops the s.
    : rival ? `${rival.gap} ${rival.gap === 1 ? unit.replace(/s$/, '') : unit} behind ${rival.name}`
    : 'Top of the board';

  const deltaText = rankDelta ? `${rankDelta > 0 ? 'Up' : 'Down'} ${Math.abs(rankDelta)} since your last visit` : null;

  return (
    <div
      className={cn(
        'sticky bottom-3 z-10 mt-3 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
        rowVisible && 'opacity-0 translate-y-2 pointer-events-none'
      )}
      inert={rowVisible || undefined}
      aria-hidden={rowVisible || undefined}
    >
      <button
        type="button"
        onClick={onJump}
        className="w-full min-h-14 bg-card border border-primary/40 rounded-xl px-4 py-2.5 flex items-center gap-3 text-left shadow-[0_6px_20px_-6px_rgb(0_0_0/0.45)] hover:border-primary/70 transition-colors"
      >
        <span className="flex flex-col min-w-0 flex-1">
          <span className="text-2xs font-mono text-muted-foreground truncate">
            Your rank <span className="text-foreground/80">{scope}</span>
          </span>
          {gapText && <span className="text-xs font-mono text-foreground truncate"><span className="sr-only">, </span>{gapText}</span>}
        </span>
        {deltaText && (
          <span
            className={cn('flex items-center gap-0.5 text-2xs font-mono font-semibold', rankDelta > 0 ? 'text-success' : 'text-muted-foreground')}
            title={deltaText}
          >
            {rankDelta > 0 ? <TrendingUp className="w-3 h-3" aria-hidden="true" /> : <TrendingDown className="w-3 h-3" aria-hidden="true" />}
            <span aria-hidden="true">{Math.abs(rankDelta)}</span>
            <span className="sr-only">{deltaText}</span>
          </span>
        )}
        <span className="sr-only">: </span>
        <span className={cn('font-display font-bold tabular-nums text-primary', status === 'ranked' ? 'text-xl' : 'text-sm')}>
          {rankText}
        </span>
        {status === 'ranked' && <ArrowDownToLine className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />}
        <span className="sr-only">, show my row</span>
      </button>
    </div>
  );
}

// True while `ref`'s element intersects the viewport (clipping by the
// scrolling <main> included).
function useOnScreen(ref, enabled) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = ref?.current;
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') {
      setOnScreen(false);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  });
  return onScreen;
}
