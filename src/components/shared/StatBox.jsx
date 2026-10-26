import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// to: makes the whole box the link (Home's Wishlist). It used to be wrapped
// in <Link className="contents">, which has no box of its own: keyboard
// focus skipped it and a focus ring had nothing to draw on.
// unit: a short suffix (Streak's "d") set apart from the number in the
// smaller label face, not the family's number face, where it fused with the
// digits: Shrikhand's "0d" read as "Od". Screen readers get `unitLabel`.
export default function StatBox({ icon, label, value, unit, unitLabel, className, glow, isLoading, to }) {
  const Icon = icon;
  const Root = to ? Link : 'div';
  return (
    <Root
      {...(to ? { to } : {})}
      className={cn(
        'bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-1',
        glow && 'neon-border',
        to && 'hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {Icon && <Icon className="w-5 h-5 text-primary mb-1" aria-hidden="true" />}
      {/* A literal '—' placeholder here read as visible clutter rather
          than "still loading" — a skeleton bar says the same thing
          without ever putting a dash on screen, and (unlike falling back
          to '0') doesn't risk flashing a real returning user's stat as
          zero for a beat before the true value arrives. */}
      {isLoading ? (
        <span className="h-6 w-8 rounded bg-secondary/60 animate-pulse" />
      ) : (
        <span className="text-2xl font-num font-bold text-foreground tabular-nums">
          {value != null ? `${value}` : '0'}
          {unit && (
            <>
              <span className="ml-0.5 text-sm font-mono font-medium text-muted-foreground" aria-hidden="true">{unit}</span>
              {unitLabel && <span className="sr-only"> {unitLabel}</span>}
            </>
          )}
        </span>
      )}
      {/* text-center: a three-up row is ~100px wide on a phone, so "RARE
          PULLS" wraps, and each line sat left-aligned in the centred box.
          pl-[0.1em]: tracking-widest adds 0.1em after every letter,
          including the last on each line; matching it on the left keeps
          the glyphs, not the trailing gap, on the centre line. */}
      <span className="text-2xs font-mono text-muted-foreground uppercase tracking-widest text-center pl-[0.1em]">{label}</span>
    </Root>
  );
}
