import StatBox from '../shared/StatBox';
import { Star, Flame, Bookmark } from 'lucide-react';

export default function StatsRow({ rarePulls, streak, wishlistCount, isLoadingRarePulls, isLoadingStreak, isLoadingWishlist }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-5">
      <StatBox icon={Star} label="Rare Pulls" value={rarePulls} glow isLoading={isLoadingRarePulls} />
      <StatBox icon={Flame} label="Streak" value={streak} unit="d" unitLabel="days" isLoading={isLoadingStreak} />
      <StatBox to="/wishlist" icon={Bookmark} label="Wishlist" value={wishlistCount} isLoading={isLoadingWishlist} />
    </div>
  );
}
