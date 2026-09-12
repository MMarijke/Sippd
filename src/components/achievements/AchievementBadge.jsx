import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function AchievementBadge({ achievement, size = 'default' }) {
  const { title, description, icon, unlocked, unlockedAt, incremental, progress } = achievement;
  const showProgress = incremental && !unlocked && progress;
  const pct = showProgress ? Math.min((progress.current / progress.goal) * 100, 100) : 0;

  if (size === 'compact') {
    // The default size below renders description as real visible text under
    // the title; this compact tile has no room for that, so it used to live
    // only behind a desktop-hover title="..." tooltip — unreachable for the
    // touch users who are this mobile-first app's actual majority (see
    // PRODUCT.md). Now a real tap target: the same Popover pattern
    // CanDetail already uses for "How Community Rarity works" opens the
    // full title/description on tap, click, or keyboard activation alike,
    // so every input method reaches the same information. aria-describedby
    // + a persistent sr-only span still carries it to screen readers
    // regardless of whether the popover is open.
    //
    // min-w-0 on the trigger: without it, the title <p>'s `truncate` did
    // nothing — a flex/grid item's default min-width is its content's
    // natural width, so an un-wrapped long title could force the tile wider
    // than its grid column instead of actually clipping (flagged by the
    // detector as a 33px overflow).
    const descriptionId = `achievement-desc-${achievement.key}`;
    return (
      <Popover>
        <PopoverTrigger
          aria-label={`${title}: ${unlocked ? 'unlocked' : 'locked'}`}
          aria-describedby={descriptionId}
          className="relative flex flex-col items-center text-center gap-1.5 w-full min-w-0 bg-transparent border-0 p-0 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all',
              unlocked
                ? 'bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]'
                : 'bg-muted/50 border border-border/30 grayscale opacity-40'
            )}
          >
            {icon}
          </div>
          {!unlocked && (
            <div className="absolute -top-1 -right-1">
              <Lock className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <p className={cn('text-xs font-mono leading-tight truncate w-full', unlocked ? 'text-foreground' : 'text-muted-foreground')}>
            {title}
          </p>
          <span id={descriptionId} className="sr-only">{description}</span>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-xs font-mono leading-relaxed" align="center">
          <p className="font-semibold text-foreground mb-1">{title}</p>
          <p className="text-muted-foreground">{description}</p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      aria-label={`${title}: ${unlocked ? 'unlocked' : 'locked'}`}
      className={cn(
        'relative flex flex-col items-center text-center p-4 rounded-2xl border transition-all',
        unlocked
          ? 'bg-card border-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.07)]'
          : 'bg-card/40 border-border/40'
      )}
    >
      {/* Icon circle */}
      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 transition-all',
          unlocked
            ? 'bg-primary/10 border border-primary/30 shadow-[0_0_16px_hsl(var(--primary)/0.15)]'
            : 'bg-muted/50 border border-border/30 grayscale opacity-40'
        )}
      >
        {icon}
      </div>

      {/* Lock overlay — decorative; locked/unlocked state is already on the
          card's own aria-label, so this stays out of the accessible name. */}
      {!unlocked && (
        <div className="absolute top-3 right-3">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      <p className={cn('text-xs font-display font-bold leading-tight mb-1 tracking-wide', unlocked ? 'text-foreground' : 'text-muted-foreground')}>
        {title}
      </p>
      <p className={cn('text-xs font-mono leading-tight', 'text-muted-foreground')}>
        {description}
      </p>

      {/* Progress bar for incremental locked achievements */}
      {showProgress && (
        <div className="w-full mt-2.5 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-muted-foreground truncate">
              {progress.current} / {progress.goal} {progress.label}
            </span>
            <span className="text-xs font-mono text-primary/70">{Math.round(pct)}%</span>
          </div>
          <div className="h-1 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* A handful of achievements (streaks, vote-count milestones) have no
          natural collection-event timestamp to show here — they still need
          a real text signal that they're unlocked, not just color/opacity,
          so this doesn't stay conditional on unlockedAt being truthy. */}
      {unlocked && (
        <p className="text-xs font-mono text-primary/60 mt-1.5 tracking-wider uppercase">
          {unlockedAt ? format(new Date(unlockedAt), 'MMM d, yyyy') : 'Unlocked'}
        </p>
      )}
    </div>
  );
}