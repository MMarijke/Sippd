import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AchievementBadge({ achievement }) {
  const { title, description, icon, unlocked, unlockedAt, incremental, progress } = achievement;
  const showProgress = incremental && !unlocked && progress;
  const pct = showProgress ? Math.min((progress.current / progress.goal) * 100, 100) : 0;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center text-center p-4 rounded-2xl border transition-all',
        unlocked
          ? 'bg-card border-primary/20 shadow-[0_0_12px_rgba(0,240,255,0.07)]'
          : 'bg-card/40 border-border/40'
      )}
    >
      {/* Icon circle */}
      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 transition-all',
          unlocked
            ? 'bg-primary/10 border border-primary/30 shadow-[0_0_16px_rgba(0,240,255,0.15)]'
            : 'bg-muted/50 border border-border/30 grayscale opacity-40'
        )}
      >
        {icon}
      </div>

      {/* Lock overlay */}
      {!unlocked && (
        <div className="absolute top-3 right-3">
          <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
      )}

      <p className={cn('text-xs font-display font-bold leading-tight mb-1 tracking-wide', unlocked ? 'text-foreground' : 'text-muted-foreground/50')}>
        {title}
      </p>
      <p className={cn('text-[10px] font-mono leading-tight', unlocked ? 'text-muted-foreground' : 'text-muted-foreground/30')}>
        {description}
      </p>

      {/* Progress bar for incremental locked achievements */}
      {showProgress && (
        <div className="w-full mt-2.5 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-mono text-muted-foreground/50 truncate">
              {progress.current} / {progress.goal} {progress.label}
            </span>
            <span className="text-[9px] font-mono text-primary/50">{Math.round(pct)}%</span>
          </div>
          <div className="h-1 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {unlocked && unlockedAt && (
        <p className="text-[9px] font-mono text-primary/60 mt-1.5 tracking-wider uppercase">
          {format(new Date(unlockedAt), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
}