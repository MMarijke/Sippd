import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSharedCansByIds } from '@/hooks/useSharedCansByIds';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Share2, Package, Flame, Trophy, Tag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths } from 'date-fns';
import { acquiredAt } from '@/lib/canDate';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { RARITY_POINTS, RARITY_ORDER, BREAKDOWN_VAR, getEffectiveRarity as getEffectiveRarityBase } from '@/lib/rarityConsensus';

// This proportion chart, like RarityHero's Home gauge, reads the
// theme-aware --breakdown-* ramp rather than the fixed RARITY_HEX/
// --rarity-* colors a can's own badge uses.
const breakdownColor = (name) => `hsl(var(${BREAKDOWN_VAR[name] || BREAKDOWN_VAR.Common}))`;
import { useStreak } from '@/lib/useStreak';
import RarityBadge from '@/components/shared/RarityBadge';
import CanImageBox from '@/components/shared/CanImageBox';
import RecapShareModal from '@/components/monthly-report/RecapShareModal';
import RecapCardTemplate from '@/components/monthly-report/RecapCardTemplate';

const RARITY_RANK = { Common: 1, Uncommon: 2, Rare: 3, 'Ultra Rare': 4, Legendary: 5 };

export default function MonthlyReport() {
  const navigate = useNavigate();
  const streak = useStreak();
  const { user } = useAuth();
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [showShareCard, setShowShareCard] = useState(false);

  const { data: collection = [], isLoading: loadingCollection } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: sharedCans = [], isLoading: loadingShared } = useSharedCansByIds(collection.map(i => i.can_id));

  const isLoading = !user || loadingCollection || loadingShared;

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const getEffectiveRarity = (item) => getEffectiveRarityBase(item, sharedCansMap);

  const monthInterval = useMemo(() => ({
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate),
  }), [monthDate]);

  const monthItems = useMemo(() =>
    collection.filter(item => {
      try {
        // The month the collector got it (their own date, else when logged).
        const when = acquiredAt(item);
        return !!when && isWithinInterval(when, monthInterval);
      } catch { return false; }
    }),
    [collection, monthInterval]
  );

  const collected = monthItems.filter(i => i.status === 'collected');
  const wishlistCount = monthItems.filter(i => i.status === 'wishlist').length;

  const rarityCounts = useMemo(() => {
    const counts = {};
    collected.forEach(item => {
      const r = getEffectiveRarity(item);
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [collected, sharedCansMap]);

  const rarityChartData = RARITY_ORDER
    .filter(r => rarityCounts[r])
    .map(r => ({ name: r, value: rarityCounts[r] }));

  const bestPull = useMemo(() => {
    if (!collected.length) return null;
    return collected.reduce((best, item) => {
      const r = getEffectiveRarity(item);
      const bestR = getEffectiveRarity(best);
      return (RARITY_RANK[r] || 0) > (RARITY_RANK[bestR] || 0) ? item : best;
    });
  }, [collected, sharedCansMap]);

  const bestPullSharedCan = bestPull ? sharedCansMap[bestPull.can_id] : null;
  const bestPullImage = bestPull?.can_image_url || bestPullSharedCan?.image_url;
  const bestPullRarity = bestPull ? getEffectiveRarity(bestPull) : null;

  const monthScore = useMemo(() =>
    collected.reduce((acc, item) => acc + (RARITY_POINTS[getEffectiveRarity(item)] || 1), 0),
    [collected, sharedCansMap]
  );

  const brandCounts = useMemo(() => {
    const counts = {};
    collected.forEach(item => {
      const brand = item.can_brand || 'Unknown';
      counts[brand] = (counts[brand] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [collected]);

  const monthLabel = format(monthDate, 'MMMM yyyy');
  const isCurrentMonth = format(monthDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const monthlyRarityBreakdown = useMemo(() => rarityChartData.map(({ name, value }) => ({
    rarity: name,
    count: value,
    pct: collected.length ? (value / collected.length) * 100 : 0,
  })), [rarityChartData, collected.length]);

  // Passed to RecapShareModal, which regenerates its capture whenever this
  // changes — mirrors every field the exported card actually shows.
  const cardSignature = useMemo(() => JSON.stringify({
    monthLabel,
    cansAdded: collected.length,
    monthScore,
    streak: streak ?? 0,
    bestPullId: bestPull?.id || null,
    bestPullRarity,
    bestPullCanBg: bestPull?.can_bg_color || null,
    rarityBreakdown: monthlyRarityBreakdown,
  }), [monthLabel, collected.length, monthScore, streak, bestPull, bestPullRarity, monthlyRarityBreakdown]);

  const hasActivity = collected.length > 0 || wishlistCount > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-border">
          <div className="w-11 h-11 rounded-full bg-card/40 animate-pulse flex-shrink-0" />
          <div className="flex-1 flex justify-center">
            <div className="h-5 w-32 bg-card/40 animate-pulse rounded-lg" />
          </div>
          <div className="w-9" />
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-card/40 animate-pulse rounded-xl" />
            <div className="h-20 bg-card/40 animate-pulse rounded-xl" />
          </div>
          <div className="h-16 bg-card/40 animate-pulse rounded-xl" />
          <div className="h-32 bg-card/40 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center border border-border flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-3">
          <button
            onClick={() => setMonthDate(d => startOfMonth(subMonths(d, 1)))}
            aria-label="Previous month"
            className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center border border-border"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-display font-bold text-foreground tracking-wide min-w-[130px] text-center">
            {monthLabel}
          </h1>
          <button
            onClick={() => setMonthDate(d => startOfMonth(addMonths(d, 1)))}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center border border-border disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="w-11" />
      </div>

      <div className="px-5 py-5 pb-32 space-y-4">

        {!hasActivity ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Package className="w-14 h-14 text-muted-foreground/20" />
            <p className="text-sm font-mono text-muted-foreground">No activity this month</p>
          </div>
        ) : (
          <>
            {/* Cans Added */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Cans Added</p>
                <p className="text-3xl font-num font-black text-primary tabular-nums">{collected.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Score Gained</p>
                <p className="text-3xl font-num font-black text-primary tabular-nums">+{monthScore}</p>
              </div>
            </div>

            {/* Streak */}
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider">Current Streak</p>
                <p className="text-xl font-display font-bold text-foreground">{streak ?? 0} days</p>
              </div>
            </div>

            {/* Best Pull */}
            {bestPull && (
              <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <p className="text-2xs font-mono text-primary uppercase tracking-wider font-semibold">Best Pull of the Month</p>
                </div>
                <div className="flex gap-4 px-4 pb-4">
                  <CanImageBox
                    imageUrl={bestPullImage}
                    rarity={bestPullRarity}
                    canBg={bestPull?.can_bg_color}
                    alt={bestPull.can_name}
                    className="w-20 h-20 rounded-xl flex-shrink-0"
                    iconSize="w-8 h-8"
                  />
                  <div className="flex flex-col justify-center gap-1.5">
                    <p className="text-2xs font-mono text-primary/70 uppercase tracking-wider">{bestPull.can_brand}</p>
                    <p className="text-base font-display font-bold text-foreground leading-tight">{bestPull.can_name}</p>
                    <RarityBadge rarity={bestPullRarity} />
                  </div>
                </div>
              </div>
            )}

            {/* Rarity Breakdown */}
            {rarityChartData.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider">Rarity Breakdown</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={rarityChartData} cx="50%" cy="50%" innerRadius={22} outerRadius={40} paddingAngle={3} dataKey="value" stroke="none">
                          {rarityChartData.map(entry => (
                            <Cell key={entry.name} fill={breakdownColor(entry.name)} style={{ stroke: 'var(--gauge-edge)', strokeWidth: 1 }} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    {rarityChartData.map(({ name, value }) => (
                      <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full gauge-seg" style={{ backgroundColor: breakdownColor(name) }} />
                          <span className="text-xs font-mono text-muted-foreground">{name}</span>
                        </div>
                        <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Brands */}
            {brandCounts.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider">Cans by Brand</p>
                </div>
                <div className="space-y-2">
                  {brandCounts.map(([brand, count]) => (
                    <div key={brand} className="flex items-center gap-2">
                      <span className="text-sm font-mono text-foreground flex-1">{brand}</span>
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(count / collected.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wishlist */}
            {wishlistCount > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                <p className="text-sm font-mono text-muted-foreground">Wishlist additions</p>
                <p className="text-xl font-display font-bold text-foreground">{wishlistCount}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Share Button */}
      {hasActivity && (
        <div className="fixed bottom-6 left-0 right-0 px-5">
          <Button
            onClick={() => setShowShareCard(true)}
            className="w-full font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-12"
          >
            <Share2 className="w-4 h-4" />
            Share Report
          </Button>
        </div>
      )}

      {showShareCard && (
        <RecapShareModal
          title="Recap Card"
          onClose={() => setShowShareCard(false)}
          cardSignature={cardSignature}
          filename={`sippd-recap-${monthLabel.replace(/\s+/g, '-')}.png`}
          shareTitle={`My ${monthLabel} Sippd Recap`}
        >
          <RecapCardTemplate
            userName={user?.full_name}
            monthLabel={monthLabel}
            cansAdded={collected.length}
            monthScore={monthScore}
            streak={streak ?? 0}
            bestPull={bestPull}
            bestPullImage={bestPullImage}
            bestPullRarity={bestPullRarity}
            rarityBreakdown={monthlyRarityBreakdown}
          />
        </RecapShareModal>
      )}
    </div>
  );
}
