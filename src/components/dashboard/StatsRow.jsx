import { Link } from 'react-router-dom';
import StatBox from '../shared/StatBox';
import { Star, Flame, Bookmark } from 'lucide-react';

// showRarePulls: Home leaves it out, since the standing card above already
// shows the leaderboard's own rare-pull count.
export default function StatsRow({ rarePulls, streak, wishlistCount, isLoadingRarePulls, isLoadingStreak, isLoadingWishlist, showRarePulls = true }) {
  return (
    <div className={`grid ${showRarePulls ? 'grid-cols-3' : 'grid-cols-2'} gap-3 px-5`}>
      {showRarePulls && <StatBox icon={Star} label="Rare Pulls" value={rarePulls} glow isLoading={isLoadingRarePulls} />}
      <StatBox icon={Flame} label="Streak" value={streak} isLoading={isLoadingStreak} />
      <Link to="/wishlist" className="contents">
        <StatBox icon={Bookmark} label="Wishlist" value={wishlistCount} className="hover:border-primary/40 transition-colors" isLoading={isLoadingWishlist} />
      </Link>
    </div>
  );
}
