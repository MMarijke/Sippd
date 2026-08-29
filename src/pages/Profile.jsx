import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { LogOut, Zap, Star, Trophy, Settings, Medal, Pencil, Check, X, Share2, ImageDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import PageHeader from '@/components/shared/PageHeader';
import StatBox from '@/components/shared/StatBox';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ShareCardModal from '@/components/profile/ShareCardModal';
import { getItemScore, getDisplayRarity } from '@/lib/rarityConsensus';
import TradeHistory from '@/components/profile/TradeHistory';
import TradeLogDialog from '@/components/profile/TradeLogDialog';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [showShareCard, setShowShareCard] = useState(false);
  const [showTradeLog, setShowTradeLog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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

  const sharedCansMap = Object.fromEntries(sharedCans.map(c => [c.id, c]));
  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    return sc ? getDisplayRarity(sc) : (item.can_rarity || 'Common');
  };

  const collected = collection.filter(c => c.status === 'collected');
  const rarePulls = collected.filter(c =>
    ['Rare', 'Ultra Rare', 'Legendary'].includes(c.can_rarity)
  ).length;
  const wishlist = collection.filter(c => c.status === 'wishlist').length;
  const favourites = collection.filter(c => c.is_favourite).length;

  const score = collected.reduce((acc, c) => {
    return acc + getItemScore(c, sharedCansMap[c.can_id]);
  }, 0);

  const handleSharedCollection = () => {
    if (!user?.id) return;
    const url = `${window.location.origin}/u/${user.id}`;
    if (navigator.share) {
      navigator.share({
        title: 'My Sippd Collection',
        text: 'Check out my Sippd collection!',
        url,
      }).catch(e => {
        if (e.name !== 'AbortError') {
          navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
        }
      });
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Profile" />

      <div className="px-5">
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
                <button onClick={saveEdit} disabled={saving} className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={cancelEdit} className="w-11 h-11 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-display font-bold text-foreground">{profile?.full_name || 'Collector'}</h2>
                <button onClick={startEdit} className="text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {profile?.region && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                📍 {profile.region}
              </p>
            )}
            <p className="text-xs font-mono text-primary mt-0.5 flex items-center gap-1">
              Score: {score}
              <Popover>
                <PopoverTrigger className="p-1.5 -m-1.5 text-primary/60 hover:text-primary transition-colors" aria-label="How Score works">
                  <Info className="w-3 h-3" />
                </PopoverTrigger>
                <PopoverContent className="w-64 text-xs font-mono leading-relaxed" side="bottom" align="start">
                  <p className="font-semibold text-foreground mb-1">How Score works</p>
                  <p className="text-muted-foreground">
                    Score weights your collection by rarity — Common counts as 1 point, Legendary as 5. It's not currently a Ranks leaderboard tab; Ranks compares by Total Cans or Rare Pulls instead.
                  </p>
                </PopoverContent>
              </Popover>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5">
        <StatBox icon={Zap} label="Cans" value={collected.length} />
        <StatBox icon={Trophy} label="Wishlist" value={wishlist} />
        <StatBox icon={Star} label="Rare" value={rarePulls} />
        <StatBox icon={Star} label="Favourites" value={favourites} glow />
      </div>

      <div className="px-5 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start font-mono text-xs gap-2 border-primary/20 text-primary hover:bg-primary/10"
          onClick={() => navigate('/achievements')}
        >
          <Medal className="w-4 h-4" /> Achievements
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start font-mono text-xs gap-2 border-primary/20 text-primary hover:bg-primary/10"
          onClick={handleSharedCollection}
        >
          <Share2 className="w-4 h-4" /> Share My Collection
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start font-mono text-xs gap-2 border-primary/20 text-primary hover:bg-primary/10"
          onClick={() => setShowShareCard(true)}
        >
          <ImageDown className="w-4 h-4" /> Generate Share Card / Instagram
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start font-mono text-xs gap-2"
          onClick={() => navigate('/settings')}
        >
          <Settings className="w-4 h-4" /> Settings
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start font-mono text-xs gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => signOut()}
        >
          <LogOut className="w-4 h-4" /> Log Out
        </Button>
      </div>
      <TradeHistory userId={user?.id} user={user} onLogTrade={() => setShowTradeLog(true)} />

      {showShareCard && (
        <ShareCardModal user={{ ...user, ...profile }} onClose={() => setShowShareCard(false)} />
      )}
      {showTradeLog && (
        <TradeLogDialog collection={collection} onClose={() => setShowTradeLog(false)} />
      )}
    </div>
  );
}
