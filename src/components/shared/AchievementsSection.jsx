import { Link } from 'react-router-dom';
import { Medal } from 'lucide-react';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import { selectHighlightAchievements } from '@/lib/achievements';

// The achievements strip shared by Profile.jsx (your own) and
// PublicProfile.jsx (anyone's) — one definition instead of two that
// quietly drift, the same fix already applied to the score/breakdown/
// can-grid card. Before this, Profile showed a 5-column grid of
// AchievementBadge (unlocked achievements plus near-unlock ones, with
// lock icons and progress bars) while PublicProfile re-implemented a
// much thinner version: an unlocked-only horizontal-scroll strip with
// no lock state, no progress, no description. Both render the exact
// same computeAchievements() output — there was no reason for the
// presentation to differ, so this adopts Profile's richer treatment for
// both. Achievement progress isn't sensitive (it's the same kind of
// gamification stat as Score or Rarity Breakdown, both already fully
// visible on a public profile), so a stranger seeing "80% of the way to
// X" is a feature, not a leak.
//
// `showViewAll` is the one thing that has to stay page-specific: the
// destination, /achievements, always shows the CURRENT viewer's own
// achievements — it has no per-profile mode. Linking a stranger there
// from someone else's public profile would navigate to the viewer's own
// page (or a login wall), not the profile they were just looking at, so
// PublicProfile never passes it.
export default function AchievementsSection({ achievements, showViewAll = false }) {
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const highlightAchievements = selectHighlightAchievements(achievements, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Medal className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-display font-bold text-foreground tracking-wide">Achievements</h2>
        <span className="text-xs font-mono text-muted-foreground">Unlocked {unlockedCount}/{achievements.length}</span>
      </div>
      <div className="grid grid-cols-5 gap-x-2 gap-y-4">
        {highlightAchievements.map(a => (
          <AchievementBadge key={a.key} achievement={a} size="compact" />
        ))}
      </div>
      {showViewAll && (
        <Link to="/achievements" className="block text-center text-xs font-mono text-primary hover:text-primary/80 transition-colors">
          View All →
        </Link>
      )}
    </div>
  );
}
