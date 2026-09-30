import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Zap, Star, Flame, Package, Lock, ArrowRightLeft, GitCompare, ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CollectionCard from '@/components/shared/CollectionCard';
import AchievementsSection from '@/components/shared/AchievementsSection';
import { computeAchievements } from '@/lib/achievements';
import FollowButton from '@/components/social/FollowButton';
import TradeRequestDialog from '@/components/social/TradeRequestDialog';
import { useMyFollows } from '@/hooks/useFollow';
import { useProStatus } from '@/hooks/useProStatus';
import { sortPinnedFirst } from '@/hooks/useCollectionHighlights';
import { useProfileShowcase } from '@/hooks/useProfileShowcase';
import ProBadge from '@/components/shared/ProBadge';
import SippdBranding from '@/components/shared/SippdBranding';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Page size for the expanded "See all" grid; matches MostWanted's.
const ALL_CANS_PAGE_SIZE = 30;

export default function PublicProfile() {
  const urlParts = window.location.pathname.split('/u/');
  const userId = urlParts[1]?.split('/')[0];
  const { user: currentUser } = useAuth();
  const [showTradeDialog, setShowTradeDialog] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?preview=true is how Settings' "Preview Public Profile" link works: an
  // owner viewing their own profile normally always sees full access via
  // the isSelf clause below, which is exactly right for the real page but
  // wrong for a preview meant to show what a STRANGER sees. This param
  // suppresses only that one short-circuit — a private account previewing
  // itself now genuinely hits the locked state, same as any other
  // non-owner, non-follower visitor would.
  const isPreview = searchParams.get('preview') === 'true';

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

  // Was an unscoped select('*') of the entire follows table — RLS
  // (follows_select_participant) kept it from leaking anything, but it
  // shared the same react-query cache key ('my-follows', userId) as the
  // properly-scoped query FollowButton/FindCollectors/Feed each used
  // independently, so whichever shape ran last effectively decided what
  // every consumer of that key saw. Now the one canonical, scoped query.
  // (/impeccable critique)
  const { data: follows = [] } = useMyFollows(currentUser?.id);

  const isFollowingTarget = useMemo(() => {
    return follows.some(f => f.following_id === userId && f.status === 'accepted');
  }, [follows, userId]);

  const isPrivate = profileUser?.is_private;
  const isSelf = currentUser?.id === userId;
  const canViewContent = !isPrivate || isFollowingTarget || (isSelf && !isPreview);

  // Trophy Case badge — the OWNER's Pro status (not the viewer's), so
  // strangers see the same badge/showcase the owner sees on their own
  // Profile. Batched via useProStatus even though this page only ever
  // needs one id, so it shares the same RPC/hook every other badge surface
  // uses rather than a bespoke single-id query.
  const proUserIds = useProStatus(userId ? [userId] : []);
  const isOwnerPro = proUserIds.has(userId);

  // rarity_votes' only RLS policy is owner-only (voter_id = auth.uid()), so
  // a direct query for someone else's votes always returns zero rows — this
  // used to be hardcoded to 0 below instead, meaning every visitor's
  // vote-based achievement badges (community_pillar, vault_hunter) always
  // showed as locked on someone else's public profile regardless of the
  // real value. get_public_vote_count re-implements canViewContent's exact
  // rule server-side, same as get_public_collection does for the
  // collection itself. (/impeccable critique)
  const { data: voteCount = 0 } = useQuery({
    queryKey: ['profile-vote-count', userId, currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_vote_count', {
        p_caller_id: currentUser?.id ?? null,
        p_profile_id: userId,
      });
      if (error) throw error;
      return data ?? 0;
    },
    enabled: !!userId,
  });

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
      // setof never comes back null from PostgREST, but a null here
      // white-screened the page (profileItems.filter), and the `= []`
      // default only covers undefined. Cheap insurance.
      return data ?? [];
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

  // Lapse-aware: public_profiles applies tick_streak()'s own rule, so an
  // abandoned streak reads 0 here just as it does on the owner's Profile
  // (20260929200000_public_profile_effective_streak.sql).
  const streak = profileUser?.current_streak || 0;

  // Achievements use the full item set (all statuses), not just collected —
  // profileItems already is this profile's own rows, no further filtering needed.
  const userAchievements = useMemo(
    () => computeAchievements(profileItems, streak, voteCount, profileUser?.created_at),
    [profileItems, streak, profileUser, voteCount]
  );

  // The same showcase the owner curates on their own Profile, from one
  // definition (useProfileShowcase): capped at the owner's pin limit,
  // pinned first, with the leaderboard's own score, rare pulls and rank.
  // This page used to compute its own -- every can uncapped, a different
  // rare-pull rule, no rank -- so the link you shared wasn't what you'd
  // curated. Signed-out visitors can't read leaderboard_scores, so they get
  // the client mirror of its rule and no rank.
  const {
    collected, showcase, totalCount, rarityBreakdown, getEffectiveRarity,
    score, rarePulls, rank, rankTotal,
  } = useProfileShowcase({
    userId,
    collection: profileItems,
    sharedCansMap,
    isOwnerPro,
    canReadLeaderboard: !!currentUser,
    streak,
    voteCount,
    userCreatedDate: profileUser?.created_at,
  });

  // "See all N cans" expands in place (there's no public collection page),
  // a page at a time so a 1000-can collector doesn't render 1000 tiles at
  // once. Sorted pinned-first, then rarest, like the showcase it extends.
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ALL_CANS_PAGE_SIZE);
  const allSorted = useMemo(
    () => (expanded ? sortPinnedFirst(collected, getEffectiveRarity) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expanded, collected, sharedCansMap]
  );
  const gridItems = expanded ? allSorted.slice(0, visibleCount) : showcase;

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
    // max-w-lg mx-auto: this route sits outside AppLayout (it has to work
    // signed out), so it never got the app's phone-width column -- on the
    // desktop browsers shared links are often opened in, tiles stretched
    // to ~400px. Same column the rest of the app uses.
    <div className="min-h-screen bg-background max-w-lg mx-auto">
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
            {/* Third person, not "Your Vault" — this route is read by an
                owner, a follower, or a total stranger off a shared link,
                never exclusively the account holder addressing themselves.
                displayName already carries the same
                profileUser?.full_name || 'Collector' fallback used by the
                h1 below, so this stays correct during loading too. */}
            <p className="text-2xs font-mono text-muted-foreground -mt-0.5">{`${displayName}'s Vault`}</p>
          </div>
        </div>
      </div>

      {/* Reached from Profile's "Preview": says what you're looking at and
          how to leave it. Privacy applies here exactly as it does for a
          stranger (canViewContent ignores isSelf in preview). */}
      {isSelf && isPreview && (
        <div role="status" className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-xs font-mono text-foreground">
            Preview: this is how other collectors see your profile.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="h-11 -my-2 -mr-1 px-2 flex-shrink-0 rounded-lg text-xs font-mono text-foreground underline underline-offset-2 hover:text-primary transition-colors"
          >
            Done
          </button>
        </div>
      )}

      <div className="px-5 py-5 space-y-4 pb-16">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Two rows: identity, then actions. Sharing one row with Trade +
                Compare (or "Sign In to Follow") squeezed the name to "Sa…"
                at 375px -- on the page strangers land on from a shared link. */}
            <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center neon-glow flex-shrink-0">
                <span className="text-2xl font-display font-bold text-foreground">{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-display font-bold text-foreground line-clamp-2 break-words">{displayName}</h1>
                  {isOwnerPro && <ProBadge />}
                  {isPrivate && <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </div>
              </div>
            </div>
              {/* Suppressed (not just empty) when the profile is private
                  and this visitor can't see it — the gate card below owns
                  that exact same action alone in that state. Rendering
                  both here and there produced two identical-looking
                  "Follow" (or "Sign In to Follow") buttons on screen at
                  once, which reads as a duplication bug, not emphasis. */}
              {canViewContent && (
                <div className="flex flex-wrap items-center gap-2">
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
              )}
            </div>

            {isPrivate && !canViewContent && (
              <div className="flex flex-col items-center gap-4 py-16 text-center bg-card border border-border rounded-2xl">
                <Lock className="w-12 h-12 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">Private Account</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">Follow {displayName} to see their collection</p>
                </div>
                {/* The instruction above used to be the only thing on the
                    page saying "Follow" with no Follow control anywhere
                    near it for a logged-out visitor, and no control at
                    all for a signed-in one — the header's own version of
                    this exact action is now suppressed while this gate is
                    showing (see canViewContent above), so this is the one
                    and only place the action lives here, right next to
                    the copy that names it. */}
                {currentUser ? (
                  <FollowButton targetUser={profileUser} currentUser={currentUser} />
                ) : (
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
              {totalCount > 0 ? (
                <CollectionCard
                  score={score}
                  rank={rank}
                  rankTotal={rankTotal}
                  items={gridItems}
                  isPro={isOwnerPro}
                  rarityBreakdown={rarityBreakdown}
                  getEffectiveRarity={getEffectiveRarity}
                  stats={[
                    { icon: Zap, label: 'Cans', value: totalCount },
                    { icon: Star, label: 'Rare Pulls', value: rarePulls },
                    { icon: Flame, label: 'Streak', value: streak },
                  ]}
                  footer={totalCount > showcase.length && (
                    <div className="mt-3 flex gap-2">
                      {!expanded ? (
                        <button
                          onClick={() => setExpanded(true)}
                          className="flex-1 h-11 rounded-xl border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                        >
                          See all {totalCount} cans
                        </button>
                      ) : (
                        <>
                          {visibleCount < totalCount && (
                            <button
                              onClick={() => setVisibleCount(n => n + ALL_CANS_PAGE_SIZE)}
                              className="flex-1 h-11 rounded-xl border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                            >
                              Show more ({totalCount - visibleCount} left)
                            </button>
                          )}
                          <button
                            onClick={() => { setExpanded(false); setVisibleCount(ALL_CANS_PAGE_SIZE); }}
                            className="flex-1 h-11 rounded-xl border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                          >
                            Showcase only
                          </button>
                        </>
                      )}
                    </div>
                  )}
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

              <SippdBranding />
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
