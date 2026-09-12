import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const RATING_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

// Shared by AddCanForm, EditEntrySheet (editable) and CanDetail (read-only)
// so the 1-10 taste rating always renders the same way everywhere it
// appears — the same one-definition-not-two lesson already applied to
// CollectionCard/AchievementsSection this session.
//
// Tap targets are ~28px, not this app's usual 44px floor: ten individual
// targets can't each hit 44px in a single row at mobile width (10*44 alone
// is already wider than most phone viewports before any gap). 28px still
// clears WCAG 2.2 AA's 24x24 CSS px minimum (`web-target-size`) with a
// small margin, and a mis-tap here just lands on the adjacent star — a
// one-tap, no-cost correction, not a destructive or hard-to-reverse action,
// so the usual HIG/Material 44px guidance is a documented, deliberate
// exception rather than an oversight.
export default function TasteRatingStars({ value, onChange, readOnly = false, size = 'default' }) {
  const starClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

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

  return (
    <div role="radiogroup" aria-label="Taste rating out of 10" className="flex gap-0.5 -m-1.5">
      {RATING_VALUES.map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 10`}
          onClick={() => onChange(value === n ? null : n)}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Star className={cn(starClass, n <= (value || 0) ? 'fill-primary text-primary' : 'text-border')} />
        </button>
      ))}
    </div>
  );
}
