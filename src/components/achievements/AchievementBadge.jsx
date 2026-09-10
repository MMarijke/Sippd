import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AchievementBadge({ achievement, size = 'default' }) {
  const { title, description, icon, unlocked, unlockedAt, incremental, progress } = achievement;
  const showProgress = incremental && !unlocked && progress;
  const pct = showProgress ? Math.min((progress.current / progress.goal) * 100, 100) : 0;

  if (size === 'compact') {
    return (
      <div
        aria-label={`${title}: ${unlocked ? 'unlocked' : 'locked'}`}
        className="relative flex flex-col items-center text-center gap-1.5"
        title={description}
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
        <p className={cn('text-[9px] font-mono leading-tight truncate w-full', unlocked ? 'text-foreground' : 'text-muted-foreground')}>
          {title}
        </p>
      </div>
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
      <p className={cn('text-[10px] font-mono leading-tight', 'text-muted-foreground')}>
        {description}
      </p>

      {/* Progress bar for incremental locked achievements */}
      {showProgress && (
        <div className="w-full mt-2.5 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-mono text-muted-foreground truncate">
              {progress.current} / {progress.goal} {progress.label}
            </span>
            <span className="text-[9px] font-mono text-primary/70">{Math.round(pct)}%</span>
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
        <p className="text-[9px] font-mono text-primary/60 mt-1.5 tracking-wider uppercase">
          {unlockedAt ? format(new Date(unlockedAt), 'MMM d, yyyy') : 'Unlocked'}
        </p>
      )}
    </div>
  );
}