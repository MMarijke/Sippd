import { Link } from 'react-router-dom';
import StatBox from '../shared/StatBox';
import { Star, Flame, Bookmark } from 'lucide-react';

export default function StatsRow({ rarePulls, streak, wishlistCount }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-5">
      <StatBox icon={Star} label="Rare Pulls" value={rarePulls} glow />
      <StatBox icon={Flame} label="Streak" value={`${streak ?? 0}d`} />
      <Link to="/wishlist" className="contents">
        <StatBox icon={Bookmark} label="Wishlist" value={wishlistCount} className="hover:border-primary/40 transition-colors" />
      </Link>
    </div>
  );
}