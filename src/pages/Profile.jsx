import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { LogOut, Zap, Star, Bookmark, Heart, Settings, Medal, Pencil, Check, X, Share2, ImageDown, Info, ScanLine, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import PageHeader from '@/components/shared/PageHeader';
import StatBox from '@/components/shared/StatBox';
import RarityBadge from '@/components/shared/RarityBadge';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import ShareCardModal from '@/components/profile/ShareCardModal';
import { getItemScore, RARITY_BG_CLASS } from '@/lib/rarityConsensus';
import { useStreak } from '@/lib/useStreak';
import { useCollectionHighlights } from '@/hooks/useCollectionHighlights';
import { useTogglePin, MAX_PINS } from '@/hooks/useTogglePin';
import { useShare } from '@/hooks/useShare';
import TradeHistory from '@/components/profile/TradeHistory';
import TradeLogDialog from '@/components/profile/TradeLogDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const streak = useStreak();
  const [showShareCard, setShowShareCard] = useState(false);
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

  const { top6, rarityBreakdown, latestAchievement, getEffectiveRarity } = useCollectionHighlights({
    collection,
    sharedCansMap,
    streak,
    voteCount: votes.length,
    userCreatedDate: user?.created_at,
  });

  const { togglePin, isPending: pinPending } = useTogglePin();
  const pinnedCount = collected.filter(c => c.pinned_at).length;

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

      {/* Score hero — matches Home.jsx's dashboard hero card treatment, pushed further with rank */}
      {!isLoading && (
        <div className="px-5">
          <div className="relative rounded-2xl hero-card p-6">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60">
              Collection Score
            </p>
            <div className="flex items-end gap-3">
              <p className="text-7xl font-mono font-black text-foreground leading-none">
                {score}
              </p>
              {rank && (
                <span className="mb-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono font-semibold text-primary">
                  #{rank}
                </span>
              )}
            </div>
            <Popover>
              <PopoverTrigger className="mt-3 inline-flex items-center gap-1.5 text-primary/60 hover:text-primary transition-colors" aria-label="How Score works">
                <Info className="w-3 h-3" />
                <span className="text-[11px] font-mono">How this works</span>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-xs font-mono leading-relaxed" side="bottom" align="start">
                <p className="font-semibold text-foreground mb-1">How Score works</p>
                <p className="text-muted-foreground">
                  Score weights your collection by rarity — Common counts as 1 point, Legendary as 5. Your rank above compares Score against every collector; the Ranks page also lets you compare by Total Cans or Rare Pulls.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Top Pulls hero — live version of the share card's showcase grid */}
      {!isLoading && top6.length > 0 && (
        <div className="px-5">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60">Top Pulls</p>
              {latestAchievement && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#FFD700]">
                  <span>{latestAchievement.icon}</span> {latestAchievement.title}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {top6.map(item => (
                <div
                  key={item.id}
                  className="relative rounded-xl overflow-hidden border border-primary/20 bg-black/20 hover:border-primary/40 transition-colors"
                >
                  <Link to={`/can/${item.can_id}`} className="block">
                    <div className="aspect-square" style={{ backgroundColor: item.can_bg_color || '#0D2B2B' }}>
                      {item.can_image_url ? (
                        <img
                          src={item.can_image_url}
                          alt={item.can_name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-lg opacity-20">🥤</span>
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <p className="text-[10px] font-semibold text-foreground truncate">{item.can_name}</p>
                      <RarityBadge rarity={getEffectiveRarity(item)} size="sm" />
                    </div>
                  </Link>
                  <button
                    onClick={() => togglePin({ collectionItem: item, pinnedCount })}
                    disabled={pinPending}
                    aria-label={item.pinned_at ? 'Unpin from showcase' : 'Pin to showcase'}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-background/90"
                  >
                    <Pin className={`w-3 h-3 transition-colors ${item.pinned_at ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                  </button>
                </div>
              ))}
            </div>
            {pinnedCount > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground mt-2">
                {pinnedCount}/{MAX_PINS} pinned
              </p>
            )}

            {rarityBreakdown.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60 mb-2">Rarity Breakdown</p>
                <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                  {rarityBreakdown.map(({ rarity, pct }) => (
                    <div key={rarity} className={`h-full ${RARITY_BG_CLASS[rarity]}`} style={{ width: `${pct}%` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {rarityBreakdown.map(({ rarity, count }) => (
                    <span key={rarity} className="text-[10px] font-mono text-muted-foreground">
                      {rarity} <span className="text-foreground">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-card/40 border border-border/30 animate-pulse" />
          ))}
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
        <div className="grid grid-cols-2 gap-3 px-5">
          <StatBox icon={Zap} label="Cans" value={collected.length} />
          <StatBox icon={Bookmark} label="Wishlist" value={wishlist} />
          <StatBox icon={Star} label="Rare" value={rarePulls} />
          <StatBox icon={Heart} label="Favourites" value={favourites} glow />
        </div>
      )}

      {/* Primary tier: showcase & share — keeps the scroll on the page's peak content */}
      <div className="px-5 space-y-2">
        <Button
          className="w-full justify-start font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowShareCard(true)}
        >
          <ImageDown className="w-4 h-4" /> Create Share Card
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start font-mono text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => navigate('/achievements')}
        >
          <Medal className="w-4 h-4" /> Achievements
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start font-mono text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10"
          onClick={handleShareProfileLink}
        >
          <Share2 className="w-4 h-4" /> Share Profile Link
        </Button>
      </div>

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

      {showShareCard && (
        <ShareCardModal user={{ ...user, ...profile }} onClose={() => setShowShareCard(false)} />
      )}
      {showTradeLog && (
        <TradeLogDialog collection={collection} onClose={() => setShowTradeLog(false)} />
      )}
    </div>
  );
}
