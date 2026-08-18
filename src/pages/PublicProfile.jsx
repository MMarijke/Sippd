import { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, Star, Flame, Package, Lock, ArrowRightLeft, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import RarityBadge from '@/components/shared/RarityBadge';
import CanImageBox from '@/components/shared/CanImageBox';
import { getDisplayRarity, getConfidence, getItemScore, RARITY_ORDER, RARITY_POINTS } from '@/lib/rarityConsensus';
import { computeAchievements } from '@/lib/achievements';
import FollowButton from '@/components/social/FollowButton';
import TradeRequestDialog from '@/components/social/TradeRequestDialog';
import { useNavigate } from 'react-router-dom';

const RARITY_COLORS = {
  'Common': '#6B7280',
  'Uncommon': '#22C55E',
  'Rare': '#3B82F6',
  'Ultra Rare': '#A855F7',
  'Legendary': '#EC4899',
};

export default function PublicProfile() {
  const urlParts = window.location.pathname.split('/u/');
  const userId = urlParts[1]?.split('/')[0];
  const [currentUser, setCurrentUser] = useState(null);
  const [showTradeDialog, setShowTradeDialog] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  // Load the target user
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users-public'],
    queryFn: () => base44.entities.User.list(),
  });

  const profileUser = useMemo(
    () => users.find(u => u.id === userId),
    [users, userId]
  );

  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows'],
    queryFn: () => base44.entities.Follow.list('-created_date', 200),
    enabled: !!currentUser?.id,
  });

  const isFollowingTarget = useMemo(() => {
    return follows.some(f => f.follower_id === currentUser?.id && f.following_id === userId && f.status === 'accepted');
  }, [follows, currentUser, userId]);

  const isPrivate = profileUser?.is_private;
  const canViewContent = !isPrivate || isFollowingTarget || currentUser?.id === userId;

  // Load all collections to derive this user's and compute rank
  const { data: allItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['all-collections-public'],
    queryFn: () => base44.entities.UserCollection.list('-created_date', 2000),
  });

  const { data: sharedCans = [], isLoading: loadingShared } = useQuery({
    queryKey: ['shared-cans-public'],
    queryFn: () => base44.entities.SharedCan.list('-created_date', 500),
  });

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const isLoading = loadingUsers || loadingItems || loadingShared;

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    if (!sc) return item.can_rarity || 'Common';
    const conf = getConfidence(sc.total_votes);
    return conf === 'unrated' ? null : getDisplayRarity(sc);
  };

  // This user's collected items
  const userEmail = profileUser?.email;
  const myItems = useMemo(
    () => allItems.filter(i => i.created_by === userEmail && i.status === 'collected'),
    [allItems, userEmail]
  );

  // Score
  const score = useMemo(
    () => myItems.reduce((acc, item) => acc + getItemScore(item, sharedCansMap[item.can_id]), 0),
    [myItems, sharedCansMap]
  );

  // Rare pulls
  const rarePulls = useMemo(
    () => myItems.filter(item => {
      const r = getEffectiveRarity(item);
      return r && ['Rare', 'Ultra Rare', 'Legendary'].includes(r);
    }).length,
    [myItems, sharedCansMap]
  );

  // Streak from user entity
  const streak = profileUser?.current_streak || 0;

  // Achievements for this user (uses their collection data)
  const userCollection = useMemo(
    () => allItems.filter(i => i.created_by === userEmail),
    [allItems, userEmail]
  );
  const userAchievements = useMemo(
    () => computeAchievements(userCollection, streak, 0, profileUser?.created_date),
    [userCollection, streak, profileUser]
  );
  const unlockedAchievements = userAchievements.filter(a => a.unlocked);

  // Global rank by score
  const globalRank = useMemo(() => {
    if (!userEmail) return null;
    const scoreByEmail = {};
    for (const item of allItems) {
      if (item.status !== 'collected') continue;
      const email = item.created_by;
      if (!email) continue;
      scoreByEmail[email] = (scoreByEmail[email] || 0) + getItemScore(item, sharedCansMap[item.can_id]);
    }
    const sorted = Object.entries(scoreByEmail).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([email]) => email === userEmail) + 1;
    return rank > 0 ? rank : null;
  }, [allItems, sharedCansMap, userEmail]);

  // Rarity breakdown for chart
  const rarityCounts = useMemo(() => {
    const counts = {};
    myItems.forEach(item => {
      const r = getEffectiveRarity(item) || 'Unrated';
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [myItems, sharedCansMap]);

  const chartData = RARITY_ORDER
    .filter(r => rarityCounts[r])
    .map(r => ({ name: r, value: rarityCounts[r] }));

  const initial = profileUser?.full_name?.[0]?.toUpperCase() || '?';
  const displayName = profileUser?.full_name || 'Collector';

  if (!isLoading && !profileUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-5">
        <Package className="w-14 h-14 text-muted-foreground/20" />
        <p className="text-sm font-mono text-muted-foreground">Profile not found</p>
        <a href="/" className="text-xs font-mono text-primary underline">Go to Canvolt</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Brand header */}
      <div className="px-5 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <p className="text-base font-display font-black text-foreground tracking-widest">CANVOLT</p>
            <p className="text-[10px] font-mono text-muted-foreground -mt-0.5">Your Energy Drink Vault</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4 pb-16">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Avatar + Name */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center neon-glow flex-shrink-0">
                <span className="text-2xl font-display font-bold text-primary">{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-display font-bold text-foreground">{displayName}</h1>
                  {isPrivate && <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>
                {globalRank && canViewContent && (
                  <p className="text-xs font-mono text-primary mt-0.5">Global Rank #{globalRank}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <FollowButton targetUser={profileUser} currentUser={currentUser} />
                {currentUser && currentUser.id !== userId && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 font-mono text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                    onClick={() => setShowTradeDialog(true)}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Trade
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 font-mono text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(`/compare?with=${userId}`)}
                  >
                    <GitCompare className="w-3.5 h-3.5" /> Compare
                  </Button>
                </div>
                )}
              </div>
            </div>

            {/* Private account wall */}
            {isPrivate && !canViewContent && (
              <div className="flex flex-col items-center gap-4 py-16 text-center bg-card border border-border rounded-2xl">
                <Lock className="w-12 h-12 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">Private Account</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">Follow {displayName} to see their collection</p>
                </div>
              </div>
            )}

            {/* Content — hidden for private accounts */}
            {canViewContent && <>
              <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-5 neon-border">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl" />
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Collection Score</span>
                </div>
                <p className="text-4xl font-display font-black text-foreground neon-text">{score}</p>
                <p className="text-xs font-mono text-muted-foreground mt-1">{myItems.length} cans in vault</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-xl font-display font-bold text-foreground">{myItems.length}</p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Cans</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <Star className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-xl font-display font-bold text-foreground">{rarePulls}</p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Rare</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <Flame className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-xl font-display font-bold text-foreground">{streak}</p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Streak</p>
                </div>
              </div>

              {/* Rarity chart */}
              {chartData.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Rarity Breakdown</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={22} outerRadius={40} paddingAngle={3} dataKey="value" stroke="none">
                            {chartData.map(entry => (
                              <Cell key={entry.name} fill={RARITY_COLORS[entry.name] || '#6B7280'} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      {chartData.map(({ name, value }) => (
                        <div key={name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[name] }} />
                            <span className="text-xs font-mono text-muted-foreground">{name}</span>
                          </div>
                          <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Collection grid */}
              {myItems.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Collection</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {myItems.map(item => {
                      const sc = sharedCansMap[item.can_id];
                      const conf = sc ? getConfidence(sc.total_votes) : 'unrated';
                      const rarity = conf === 'unrated' ? null : getDisplayRarity(sc || item);
                      const imageUrl = item.can_image_url || sc?.image_url;
                      return (
                        <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden">
                          <CanImageBox imageUrl={imageUrl} bgColor={item.can_bg_color} alt={item.can_name} className="aspect-square" iconSize="w-7 h-7" />
                          <div className="px-2 py-1.5 space-y-0.5">
                            <p className="text-[10px] font-mono text-primary/70 truncate">{item.can_brand}</p>
                            <p className="text-xs font-semibold text-foreground truncate leading-tight">{item.can_name}</p>
                            <div className="pt-0.5">
                              {rarity ? <RarityBadge rarity={rarity} size="sm" /> : <span className="text-[10px] font-mono text-muted-foreground">? ? ?</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {myItems.length === 0 && (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Package className="w-12 h-12 text-muted-foreground/20" />
                  <p className="text-sm font-mono text-muted-foreground">No cans collected yet</p>
                </div>
              )}

              {/* Achievements */}
              {unlockedAchievements.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Achievements</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {unlockedAchievements.map(a => (
                      <div key={a.key} className="flex-shrink-0 flex flex-col items-center gap-1 bg-card border border-primary/20 rounded-xl p-3 w-20">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-xl">{a.icon}</div>
                        <p className="text-[9px] font-mono text-center text-muted-foreground leading-tight">{a.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-border text-center">
                <p className="text-[11px] font-mono text-muted-foreground">
                  Track your energy drink collection at{' '}
                  <a href="/" className="text-primary underline">Canvolt</a>
                </p>
              </div>
            </>}
          </>
        )}
      </div>
      {showTradeDialog && (
        <TradeRequestDialog
          targetUser={profileUser}
          currentUser={currentUser}
          onClose={() => setShowTradeDialog(false)}
        />
      )}
    </div>
  );
}