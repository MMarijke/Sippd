import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { AlertCircle, LogOut, RefreshCw, Settings, Pencil, Check, X, ScanLine, Zap, Star, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import CollectionCard from '@/components/shared/CollectionCard';
import AchievementsSection from '@/components/shared/AchievementsSection';
import { toast } from 'sonner';
import { getItemScore } from '@/lib/rarityConsensus';
import { useStreak } from '@/lib/useStreak';
import { useCollectionHighlights } from '@/hooks/useCollectionHighlights';
import { useTogglePin } from '@/hooks/useTogglePin';
import { useShare } from '@/hooks/useShare';
import { computeAchievements } from '@/lib/achievements';
import TradeHistory from '@/components/profile/TradeHistory';
import TradeLogDialog from '@/components/profile/TradeLogDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const streak = useStreak();
  const [showTradeLog, setShowTradeLog] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const { data: profile, isLoading, isError: profileError } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profileError) toast.error('Could not load your profile');
  }, [profileError]);

  const startEdit = () => {
    setNameInput(profile?.full_name || '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: nameInput.trim() }).eq('id', user.id);
    if (error) {
      toast.error('Failed to update name');
    } else {
      queryClient.invalidateQueries({ queryKey: ['my-profile', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      toast.success('Display name updated!');
    }
    setSaving(false);
    setEditing(false);
  };

  const {
    data: collection = [],
    isLoading: isLoadingCollection,
    isError: isCollectionError,
    refetch: refetchCollection,
  } = useQuery({
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

  const {
    data: sharedCans = [],
    isLoading: isLoadingSharedCans,
    isError: isSharedCansError,
  } = useQuery({
    queryKey: ['shared-cans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: votes = [],
    isLoading: isLoadingVotes,
    isError: isVotesError,
    refetch: refetchVotes,
  } = useQuery({
    queryKey: ['my-votes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rarity_votes')
        .select('*')
        .eq('voter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Achievements strip and the collection card both depend on collection/
  // sharedCans/votes, not just profile — gating them on the profile
  // query's isLoading alone let the "No cans yet" empty state flash for
  // real collectors while those other queries were still in flight.
  const contentLoading = isLoading || isLoadingCollection || isLoadingSharedCans || isLoadingVotes;
  // collection/votes drive what's actually rendered (achievements, the
  // collection card, the empty state) — a failure here is indistinguishable
  // from a genuinely empty collection unless it's surfaced explicitly.
  // sharedCans/rank only back secondary display (score/rarity, the rank
  // badge), so those get a toast rather than blocking the whole section.
  const contentError = isCollectionError || isVotesError;

  useEffect(() => {
    if (isCollectionError) toast.error('Could not load your collection');
    if (isVotesError) toast.error('Could not load your rarity votes');
    if (isSharedCansError) toast.error('Could not load can data');
  }, [isCollectionError, isVotesError, isSharedCansError]);

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const collected = useMemo(
    () => collection.filter(c => c.status === 'collected'),
    [collection]
  );

  const rarePulls = useMemo(
    () => collected.filter(c => ['Rare', 'Ultra Rare', 'Legendary'].includes(c.can_rarity)).length,
    [collected]
  );

  const score = useMemo(
    () => collected.reduce((acc, c) => acc + getItemScore(c, sharedCansMap[c.can_id]), 0),
    [collected, sharedCansMap]
  );

  const { top6, rarityBreakdown, getEffectiveRarity } = useCollectionHighlights({
    collection,
    sharedCansMap,
    streak,
    voteCount: votes.length,
    userCreatedDate: user?.created_at,
  });

  const achievements = useMemo(
    () => computeAchievements(collection, streak, votes.length, user?.created_at),
    [collection, streak, votes.length, user?.created_at]
  );

  const { togglePin, isPending: pinPending } = useTogglePin();
  const pinnedCount = collected.filter(c => c.pinned_at).length;

  const { copyLink, shareLink } = useShare();

  const { data: rank, isError: isRankError } = useQuery({
    queryKey: ['my-rank', user?.id, score],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leaderboard_scores')
        .select('*', { count: 'exact', head: true })
        .gt('score', score);
      if (error) throw error;
      return (count || 0) + 1;
    },
    enabled: !!user?.id && score > 0,
  });

  useEffect(() => {
    if (isRankError) toast.error('Could not load your rank');
  }, [isRankError]);

  // Share the live profile link, not a generated image — /u/:userId is a
  // real page now (Phase 1 of the public-profile migration), so there's
  // nothing to render off-screen or capture. Native share sheet first
  // (drops straight into Messages/WhatsApp/etc. on mobile); copyLink is
  // the fallback everywhere that isn't supported (typically desktop),
  // matching the same supported/fallback pattern MonthlyReport's own
  // image share already uses.
  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/u/${user.id}`;
    const title = `${profile?.full_name || 'My'} Sippd Collection`;
    const result = await shareLink({ url: profileUrl, title });
    if (result.supported) {
      if (result.error) toast.error('Could not share profile link');
      return;
    }
    copyLink(profileUrl, 'Profile link copied!');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profile"
        showBell={false}
        action={
          <Link
            to="/settings"
            aria-label="Settings"
            className="w-11 h-11 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Settings className="w-4 h-4" />
          </Link>
        }
      />

      <div className="px-5 flex items-center gap-3">
        {isLoading ? (
          <>
            <div className="w-10 h-10 rounded-lg bg-card/40 animate-pulse flex-shrink-0" />
            <div className="h-4 w-28 bg-card/40 animate-pulse rounded-lg" />
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-display font-bold text-primary">
                {profile?.full_name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            {editing ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input
                  ref={inputRef}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="h-8 text-sm font-display bg-secondary border-primary/30 focus-visible:ring-primary/50 px-2"
                  maxLength={40}
                />
                <button onClick={saveEdit} disabled={saving || !nameInput.trim()} aria-label="Save name" className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors flex-shrink-0 disabled:opacity-40 disabled:pointer-events-none">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={cancelEdit} aria-label="Cancel" className="w-11 h-11 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-base font-display font-bold text-foreground truncate">{profile?.full_name || 'Collector'}</h2>
                <button onClick={startEdit} aria-label="Edit display name" className="p-4 text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
                {profile?.region && (
                  <span className="text-xs font-mono text-muted-foreground truncate">· 📍 {profile.region}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {contentError ? (
        <div className="px-5">
          <div className="bg-card border border-destructive/30 rounded-2xl p-10 flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <p className="text-sm font-display font-semibold text-foreground">Couldn't load your collection</p>
            <Button
              variant="outline"
              size="sm"
              className="h-11 mt-4 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => { refetchCollection(); refetchVotes(); }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Collection Card leads, Achievements follows — this is the
              page's trophy case (Score now gets a real .hero-card
              treatment), so the showcase should be the first thing a
              returning user sees, not a wall of mostly-locked grey
              badges. Tapping Share hands out this profile's real,
              always-current /u/:userId link (see handleShareProfile) —
              no separate export step, no captured image to go stale;
              MonthlyReport is the one surface left that shares a
              generated snapshot, because a month that's already over
              has nothing left to go stale. */}
          {contentLoading ? (
            <div className="px-5">
              <div className="h-64 rounded-2xl bg-card/40 border border-border/30 animate-pulse" />
            </div>
          ) : collected.length === 0 ? (
            <div className="px-5">
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <ScanLine className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-display font-bold text-foreground">No cans yet</p>
                <p className="text-xs font-mono text-muted-foreground mt-1 max-w-[240px]">
                  Scan your first can to start tracking your score, rare pulls, and collection stats.
                </p>
                <Button
                  className="h-11 mt-4 font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => navigate('/scan')}
                >
                  <ScanLine className="w-4 h-4" /> Scan Your First Can
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-5">
              <CollectionCard
                headerTitle={`${profile?.full_name || 'Collector'}’s Collection`}
                items={top6}
                rarityBreakdown={rarityBreakdown}
                getEffectiveRarity={getEffectiveRarity}
                pinnedCount={pinnedCount}
                onTogglePin={item => togglePin({ collectionItem: item, pinnedCount })}
                pinPending={pinPending}
                onShare={handleShareProfile}
                score={score}
                rank={rank}
                canEdit
                stats={[
                  { icon: Zap, label: 'Cans', value: collected.length },
                  { icon: Star, label: 'Rare Pulls', value: rarePulls },
                  { icon: Flame, label: 'Streak', value: streak ?? 0 },
                ]}
              />
            </div>
          )}

          {/* Achievements strip — shared with PublicProfile.jsx, see
              AchievementsSection's own doc comment. */}
          {!contentLoading && (
            <div className="px-5">
              <AchievementsSection achievements={achievements} showViewAll />
            </div>
          )}
        </>
      )}

      <TradeHistory userId={user?.id} user={user} onLogTrade={() => setShowTradeLog(true)} />

      {/* Utility tier: log out — stays last, the standard trailing position.
          Settings now lives as the gear icon in the header. */}
      <div className="px-5 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start font-mono text-xs gap-2 text-destructive hover:bg-destructive/10"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut className="w-4 h-4" /> Log Out
        </Button>
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => signOut()}
        title="Log Out?"
        description="You'll need to sign back in to view your collection and stats."
        confirmLabel="Log Out"
      />

      {showTradeLog && (
        <TradeLogDialog collection={collection} onClose={() => setShowTradeLog(false)} />
      )}
    </div>
  );
}
