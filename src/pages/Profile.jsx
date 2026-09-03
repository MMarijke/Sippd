import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { LogOut, Bookmark, Heart, Settings, Medal, Pencil, Check, X, Share2, Download, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatBox from '@/components/shared/StatBox';
import CollectionCard from '@/components/profile/CollectionCard';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import { toast } from 'sonner';
import { getItemScore } from '@/lib/rarityConsensus';
import { useStreak } from '@/lib/useStreak';
import { useCollectionHighlights } from '@/hooks/useCollectionHighlights';
import { useTogglePin } from '@/hooks/useTogglePin';
import { useShare } from '@/hooks/useShare';
import { useCardCapture } from '@/hooks/useCardCapture';
import { computeAchievements, selectHighlightAchievements } from '@/lib/achievements';
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

  const { data: collection = [] } = useQuery({
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

  const { data: sharedCans = [] } = useQuery({
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

  const { data: votes = [] } = useQuery({
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

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const collected = collection.filter(c => c.status === 'collected');
  const rarePulls = collected.filter(c =>
    ['Rare', 'Ultra Rare', 'Legendary'].includes(c.can_rarity)
  ).length;
  const wishlist = collection.filter(c => c.status === 'wishlist').length;
  const favourites = collection.filter(c => c.is_favourite).length;

  const score = collected.reduce((acc, c) => {
    return acc + getItemScore(c, sharedCansMap[c.can_id]);
  }, 0);

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
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const highlightAchievements = useMemo(
    () => selectHighlightAchievements(achievements, 10),
    [achievements]
  );

  const { togglePin, isPending: pinPending } = useTogglePin();
  const pinnedCount = collected.filter(c => c.pinned_at).length;

  const [showShareCard, setShowShareCard] = useState(false);
  const captureRef = useRef(null);

  const cardSignature = useMemo(() => {
    const cans = top6.map(item => `${item.id}:${getEffectiveRarity(item)}:${item.pinned_at || ''}`).join('|');
    const breakdown = rarityBreakdown.map(r => `${r.rarity}:${r.count}`).join(',');
    return `${cans}__${breakdown}__${streak}__${score}`;
  }, [top6, rarityBreakdown, streak, score, getEffectiveRarity]);

  const { generating, cardDataUrl, saving: cardSaving, generateCard, handleSave, handleShareImage } = useCardCapture(captureRef, cardSignature);

  // The card only mounts (and its ref attaches) once showShareCard flips
  // true — useCardCapture's own effect only regenerates on signature
  // changes, so opening needs its own explicit first-generate call.
  useEffect(() => {
    if (showShareCard) generateCard();
  }, [showShareCard]);

  const { data: rank } = useQuery({
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

  const { copyLink } = useShare();

  const handleShareProfileLink = () => {
    if (!user?.id) return;
    const url = `${window.location.origin}/u/${user.id}`;
    copyLink(url, 'Link copied!');
  };

  return (
    <div className="space-y-5 pb-24">
      <PageHeader title="Profile" />

      <div className="px-5">
        {isLoading ? (
          <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-card/40 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-5 w-32 bg-card/40 animate-pulse rounded-lg" />
              <div className="h-4 w-20 bg-card/40 animate-pulse rounded-lg" />
            </div>
          </div>
        ) : (
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center neon-glow">
            <span className="text-2xl font-display font-bold text-primary">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1.5">
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-display font-bold text-foreground">{profile?.full_name || 'Collector'}</h2>
                <button onClick={startEdit} aria-label="Edit display name" className="p-1.5 -m-1.5 text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {profile?.region && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                📍 {profile.region}
              </p>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Achievements strip */}
      {!isLoading && (
        <div className="px-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Medal className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-display font-bold text-foreground tracking-wide">Achievements</h2>
              <span className="text-xs font-mono text-muted-foreground">Unlocked {unlockedCount}/{achievements.length}</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-x-2 gap-y-4">
            {highlightAchievements.map(a => (
              <AchievementBadge key={a.key} achievement={a} size="compact" />
            ))}
          </div>
          <Link to="/achievements" className="block text-center text-xs font-mono text-primary hover:text-primary/80 transition-colors">
            View All →
          </Link>
        </div>
      )}

      {/* Collection Card — this card is the share card. Tapping the share
          icon expands the same card into a Save/Share preview inline,
          instead of opening a separate full-screen surface. */}
      {isLoading ? (
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
              className="mt-4 font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/scan')}
            >
              <ScanLine className="w-4 h-4" /> Scan Your First Can
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          <CollectionCard
            mode="live"
            top6={top6}
            rarityBreakdown={rarityBreakdown}
            getEffectiveRarity={getEffectiveRarity}
            pinnedCount={pinnedCount}
            onTogglePin={item => togglePin({ collectionItem: item, pinnedCount })}
            pinPending={pinPending}
            sharing={showShareCard}
            onShare={() => setShowShareCard(v => !v)}
            score={score}
            rarePulls={rarePulls}
            totalCans={collected.length}
            rank={rank}
          />

          {showShareCard && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              {/* Hidden capture-mode card for html2canvas — not visible to user */}
              <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}>
                <CollectionCard
                  ref={captureRef}
                  mode="capture"
                  top6={top6}
                  rarityBreakdown={rarityBreakdown}
                  sharedCansMap={sharedCansMap}
                  userName={profile?.full_name}
                  score={score}
                  totalCans={collected.length}
                  rarePulls={rarePulls}
                />
              </div>

              {generating && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-mono text-muted-foreground">Generating card…</p>
                </div>
              )}

              {cardDataUrl && !generating && (
                <img src={cardDataUrl} alt="Share card" className="w-full rounded-2xl border border-border" />
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => handleSave('sippd-collection.png')}
                  disabled={!cardDataUrl || generating || cardSaving}
                >
                  <Download className="w-4 h-4" />
                  {cardSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => handleShareImage('sippd-collection.png', 'My Sippd Collection')}
                  disabled={!cardDataUrl || generating || cardSaving}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full font-mono text-xs text-muted-foreground gap-2"
                onClick={generateCard}
                disabled={generating}
              >
                {generating ? '…' : '↻'} Regenerate
              </Button>
            </div>
          )}

          {/* Wishlist/Favourites have no other home in the new layout (Score,
              Rare Pulls, and Cans all moved into the Collection Card above)
              — kept as a small secondary row rather than dropped silently. */}
          <div className="grid grid-cols-2 gap-3">
            <StatBox icon={Bookmark} label="Wishlist" value={wishlist} />
            <StatBox icon={Heart} label="Favourites" value={favourites} glow />
          </div>

          <Button
            variant="outline"
            className="w-full justify-start font-mono text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleShareProfileLink}
          >
            <Share2 className="w-4 h-4" /> Share Profile Link
          </Button>
        </div>
      )}

      <TradeHistory userId={user?.id} user={user} onLogTrade={() => setShowTradeLog(true)} />

      {/* Utility tier: settings & log out — stays last, the standard trailing position */}
      <div className="px-5 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start font-mono text-xs gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/settings')}
        >
          <Settings className="w-4 h-4" /> Settings
        </Button>
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
