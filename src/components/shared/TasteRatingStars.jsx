import { useRef } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const RATING_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

// Shared by AddCanForm, EditEntrySheet (editable) and CanDetail (read-only)
// so the 1-10 taste rating always renders the same way everywhere it
// appears — the same one-definition-not-two lesson already applied to
// CollectionCard/AchievementsSection this session.
//
// Tap targets are 32px, not this app's usual 44px floor: ten individual
// targets can't each hit 44px in a single row at mobile width (10*44 alone
// is already wider than most phone viewports before any gap). 32px clears
// WCAG 2.2 AA's 24x24 CSS px minimum (`web-target-size`) with real margin,
// and a mis-tap here just lands on the adjacent star — a one-tap, no-cost
// correction, not a destructive or hard-to-reverse action, so the usual
// HIG/Material 44px guidance is a documented, deliberate exception rather
// than an oversight. Was previously 28px with a 2px gap despite ~52px of
// unused horizontal room at 390px width — widened to close as much of that
// gap to the 44px convention as ten-in-a-row actually allows, still with
// room to spare (/impeccable critique).
export default function TasteRatingStars({ value, onChange, readOnly = false, size = 'default' }) {
  const starClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const buttonRefs = useRef([]);

  if (readOnly) {
    return (
      <div
        className="flex gap-1"
        role="img"
        aria-label={value ? `Rated ${value} out of 10` : 'Not rated yet'}
      >
        {RATING_VALUES.map(n => (
          <Star
            key={n}
            aria-hidden="true"
            className={cn(starClass, n <= (value || 0) ? 'fill-primary text-primary' : 'text-border')}
          />
        ))}
      </div>
    );
  }

  // Roving tabindex (WAI-ARIA radiogroup pattern): only one star sits in
  // the page's tab order at a time — the current value, or the first star
  // when nothing's picked yet — instead of ten separate stops. Arrow keys
  // move focus AND selection together between stars, matching how a native
  // radio group behaves; Tab moves past the whole group in one step.
  const activeValue = value || 1;

  const handleKeyDown = (e, n) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(10, n + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, n - 1);
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = 10;
    if (next !== null) {
      e.preventDefault();
      onChange(next);
      buttonRefs.current[next - 1]?.focus();
    }
  };

  return (
    <div className="space-y-1">
      <div role="radiogroup" aria-label="Taste rating out of 10" className="flex gap-1 -m-1.5">
        {RATING_VALUES.map(n => (
          <button
            key={n}
            ref={el => { buttonRefs.current[n - 1] = el; }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 10`}
            tabIndex={n === activeValue ? 0 : -1}
            onKeyDown={e => handleKeyDown(e, n)}
            onClick={() => onChange(value === n ? null : n)}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Star className={cn(starClass, n <= (value || 0) ? 'fill-primary text-primary' : 'text-border')} />
          </button>
        ))}
      </div>
      <p className="text-[11px] font-mono text-muted-foreground">1 = not for me · 10 = all-time favorite</p>
    </div>
  );
}
