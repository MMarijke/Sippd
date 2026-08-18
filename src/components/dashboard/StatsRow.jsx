import StatBox from '../shared/StatBox';
import { Zap, Star, Flame, TrendingUp } from 'lucide-react';

export default function StatsRow({ totalCans, rarePulls, streak, score }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5">
      <StatBox icon={Zap} label="Total Cans" value={totalCans} glow />
      <StatBox icon={Star} label="Rare Pulls" value={rarePulls} />
      <StatBox icon={Flame} label="Streak" value={`${streak ?? 0}d`} />
      <StatBox icon={TrendingUp} label="Score" value={score} />
    </div>
  );
}