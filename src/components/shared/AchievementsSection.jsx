import { Link } from 'react-router-dom';
import { Medal } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { selectShelfAchievements } from '@/lib/achievements';

// Shared by Profile and PublicProfile. A short shelf, not a strip: the three
// most recent unlocks, then the two closest to unlocking with their progress
// (selectShelfAchievements). The old 10-tile, 5-column strip was ~70% locked
// grey with every title truncated at 375px; full titles now wrap instead,
// and the whole collection lives one tap away under View All.
export default function AchievementsSection({ achievements, showViewAll = false }) {
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const shelf = selectShelfAchievements(achievements);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Medal className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-display font-bold text-foreground tracking-wide">Achievements</h2>
        <span className="text-xs font-mono text-muted-foreground">Unlocked {unlockedCount}/{achievements.length}</span>
      </div>
      <ul className="space-y-2">
        {shelf.map(a => {
          const current = a.progress?.current ?? 0;
          const goal = a.progress?.goal ?? 0;
          const pct = goal ? Math.min(100, (current / goal) * 100) : 0;
          return (
            <li key={a.key} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 border',
                  a.unlocked ? 'bg-primary/10 border-primary/30' : 'bg-secondary border-border grayscale opacity-60'
                )}
              >
                {a.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-snug">{a.title}</p>
                {a.unlocked ? (
                  <p className="text-xs font-mono text-muted-foreground">
                    Unlocked{a.unlockedAt ? ` · ${format(new Date(a.unlockedAt), 'd MMM yyyy')}` : ''}
                  </p>
                ) : a.incremental && a.progress ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      role="progressbar"
                      aria-label={`${a.title} progress`}
                      aria-valuemin={0}
                      aria-valuemax={goal}
                      aria-valuenow={current}
                      className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden"
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                      {current}/{goal} {a.progress.label}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-muted-foreground">{a.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {showViewAll && (
        <Link to="/achievements" className="block text-center text-xs font-mono text-foreground hover:text-primary transition-colors">
          View All →
        </Link>
      )}
    </div>
  );
}
