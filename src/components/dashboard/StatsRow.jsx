import StatBox from '../shared/StatBox';
import { Zap, Star, Flame, Bookmark } from 'lucide-react';

export default function StatsRow({ totalCans, rarePulls, streak, wishlistCount }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5">
      <StatBox icon={Zap} label="Total Cans" value={totalCans} glow />
      <StatBox icon={Star} label="Rare Pulls" value={rarePulls} />
      <StatBox icon={Flame} label="Streak" value={`${streak ?? 0}d`} />
      <StatBox icon={Bookmark} label="Wishlist" value={wishlistCount} />
    </div>
  );
}