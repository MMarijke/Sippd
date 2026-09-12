import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Zap, Star, Flame, Package, Lock, ArrowRightLeft, GitCompare, ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CollectionCard from '@/components/shared/CollectionCard';
import AchievementsSection from '@/components/shared/AchievementsSection';
import { getDisplayRarity, getConfidence, getItemScore, RARITY_ORDER } from '@/lib/rarityConsensus';
import { computeAchievements } from '@/lib/achievements';
import FollowButton from '@/components/social/FollowButton';
import TradeRequestDialog from '@/components/social/TradeRequestDialog';
import { useNavigate } from 'react-router-dom';

export default function PublicProfile() {
  const urlParts = window.location.pathname.split('/u/');
  const userId = urlParts[1]?.split('/')[0];
  const { user: currentUser } = useAuth();
  const [showTradeDialog, setShowTradeDialog] = useState(false);
  const navigate = useNavigate();

  // Narrow public view — id, full_name, is_private, current_streak, created_at only.
  // No email, no role, no raw profiles table read for another user.
  const { data: profileUser, isLoading: loadingProfile, isError: profileError } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    },
    enabled: !!userId,
  });

  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('follows').select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const isFollowingTarget = useMemo(() => {
    return follows.some(f => f.follower_id === currentUser?.id && f.following_id === userId && f.status === 'accepted');
  }, [follows, currentUser, userId]);

  const isPrivate = profileUser?.is_private;
  const canViewContent = !isPrivate || isFollowingTarget || currentUser?.id === userId;

  // Via get_public_collection, not a direct table query — user_collection's
  // only RLS policy is owner-only (owner_id = auth.uid()), so a direct
  // .from('user_collection') read here would silently return zero rows for
  // every viewer except the profile's own owner, private or not. The RPC
  // re-implements canViewContent's exact rule (public, or owner, or
  // accepted follower) server-side and also works for a logged-out caller —
  // p_caller_id: null there, which the function treats as "not the owner,
  // not a follower" rather than raising. See the 2026-09-12 migration.
  const { data: profileItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['profile-collection', userId, currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_collection', {
        p_caller_id: currentUser?.id ?? null,
        p_profile_id: userId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: sharedCans = [], isLoading: loadingShared } = useQuery({
    queryKey: ['shared-cans-public'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shared_cans').select('*').limit(500);
      if (error) throw error;
      return data;
    },
  });

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const isLoading = loadingProfile || loadingItems || loadingShared;

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    if (!sc) return item.can_rarity || 'Common';
    const conf = getConfidence(sc.total_votes);
    return conf === 'unrated' ? null : getDisplayRarity(sc);
  };

  const myItems = useMemo(
    () => profileItems.filter(i => i.status === 'collected'),
    [profileItems]
  );

  const score = useMemo(
    () => myItems.reduce((acc, item) => acc + getItemScore(item, sharedCansMap[item.can_id]), 0),
    [myItems, sharedCansMap]
  );

  const rarePulls = useMemo(
    () => myItems.filter(item => {
      const r = getEffectiveRarity(item);
      return r && ['Rare', 'Ultra Rare', 'Legendary'].includes(r);
    }).length,
    [myItems, sharedCansMap]
  );

  const streak = profileUser?.current_streak || 0;

  // Achievements use the full item set (all statuses), not just collected —
  // profileItems already is this profile's own rows, no further filtering needed.
  const userAchievements = useMemo(
    () => computeAchievements(profileItems, streak, 0, profileUser?.created_at),
    [profileItems, streak, profileUser]
  );

  // TODO: global rank needs a public leaderboard aggregate (see Leaderboard.jsx
  // slice) — the old client-side "load everyone's collection and rank" approach
  // is impossible under owner-scoped RLS on user_collection.

  // Same shape (and same unrated-items-silently-excluded behavior) as
  // Profile's useCollectionHighlights — kept in sync by hand since this
  // page's data (a public RPC read, not the owner-scoped table query
  // that hook wraps) can't reuse that hook directly.
  const rarityBreakdown = useMemo(() => {
    const counts = {};
    myItems.forEach(item => {
      const r = getEffectiveRarity(item);
      counts[r] = (counts[r] || 0) + 1;
    });
    return RARITY_ORDER
      .filter(r => counts[r])
      .map(r => ({ rarity: r, count: counts[r], pct: myItems.length ? (counts[r] / myItems.length) * 100 : 0 }));
  }, [myItems, sharedCansMap]);

  const initial = profileUser?.full_name?.[0]?.toUpperCase() || '?';
  const displayName = profileUser?.full_name || 'Collector';

  if (!isLoading && profileError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-5">
        <Package className="w-14 h-14 text-muted-foreground/20" />
        <p className="text-sm font-mono text-muted-foreground">Something went wrong loading this profile</p>
        <button onClick={() => navigate(-1)} className="text-xs font-mono text-primary underline">Go Back</button>
      </div>
    );
  }

  if (!isLoading && !profileUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-5">
        <Package className="w-14 h-14 text-muted-foreground/20" />
        <p className="text-sm font-mono text-muted-foreground">Profile not found</p>
        <button onClick={() => navigate(-1)} className="text-xs font-mono text-primary underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-6 pb-4 border-b border-border flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <p className="text-base font-display font-black text-foreground tracking-widest">SIPPD</p>
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
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center neon-glow flex-shrink-0">
                <span className="text-2xl font-display font-bold text-primary">{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-display font-bold text-foreground truncate">{displayName}</h1>
                  {isPrivate && <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentUser ? (
                  <>
                    <FollowButton targetUser={profileUser} currentUser={currentUser} />
                    {currentUser.id !== userId && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 font-mono text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                          onClick={() => setShowTradeDialog(true)}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" /> Trade
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 font-mono text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground"
                          onClick={() => navigate(`/compare?with=${userId}`)}
                        >
                          <GitCompare className="w-3.5 h-3.5" /> Compare
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  // The realistic default for this route: someone with no
                  // session at all, here because a link was shared with
                  // them. FollowButton and the Trade/Compare pair above
                  // both render nothing for that visitor — this was the
                  // page's actual growth loop (the reason a public,
                  // shareable profile exists) dead-ending on its most
                  // common path. Shaped like the Follow button it stands
                  // in for (same primary fill, same UserPlus icon) so it
                  // reads as "this is where following happens," not as a
                  // generic auth wall. state.from sends Login.jsx back to
                  // this exact profile after sign-in, not to the home
                  // dashboard — losing the page they came to act on would
                  // cost the conversion this button exists to create.
                  <Button
                    size="sm"
                    className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
                    onClick={() => navigate('/login', { state: { from: `/u/${userId}` } })}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Sign In to Follow
                  </Button>
                )}
              </div>
            </div>

            {isPrivate && !canViewContent && (
              <div className="flex flex-col items-center gap-4 py-16 text-center bg-card border border-border rounded-2xl">
                <Lock className="w-12 h-12 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">Private Account</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">Follow {displayName} to see their collection</p>
                </div>
              </div>
            )}

            {canViewContent && <>
              {/* Same shared trophy-case CollectionCard Profile.jsx renders
                  for your own collection — score hero, stat row, rarity
                  breakdown bar, can grid — just with canEdit left off, so
                  there's no pin button and no can-detail link (CanDetail's
                  own query is owner-scoped; linking a stranger there would
                  show nothing useful). Skipped entirely at zero cans,
                  matching Profile.jsx's own pattern of replacing the whole
                  card with a single empty message rather than showing a
                  zero-score card with an empty grid underneath it. */}
              {myItems.length > 0 ? (
                <CollectionCard
                  score={score}
                  items={myItems}
                  rarityBreakdown={rarityBreakdown}
                  getEffectiveRarity={getEffectiveRarity}
                  stats={[
                    { icon: Zap, label: 'Cans', value: myItems.length },
                    { icon: Star, label: 'Rare Pulls', value: rarePulls },
                    { icon: Flame, label: 'Streak', value: streak },
                  ]}
                />
              ) : (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Package className="w-12 h-12 text-muted-foreground/20" />
                  <p className="text-sm font-mono text-muted-foreground">{displayName} hasn&rsquo;t collected anything yet</p>
                </div>
              )}

              {/* Same shared AchievementsSection Profile.jsx renders — see
                  its own doc comment for why showing locked/near-unlock
                  achievements to a stranger is fine (it's the same kind of
                  gamification stat as Score, already fully public), and
                  why showViewAll stays off here (/achievements has no
                  per-profile mode). */}
              <AchievementsSection achievements={userAchievements} />

              <div className="pt-4 border-t border-border text-center">
                <p className="text-[11px] font-mono text-muted-foreground">
                  Track your energy drink collection at{' '}
                  <a href="/" className="text-primary underline">Sippd</a>
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
