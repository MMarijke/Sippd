import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, GitCompare, Package, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RarityBadge from '@/components/shared/RarityBadge';
import CanImageBox from '@/components/shared/CanImageBox';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'mine', label: 'Only Mine' },
  { key: 'theirs', label: 'Only Theirs' },
  { key: 'both', label: 'In Common' },
];

export default function CompareCollection() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const friendId = urlParams.get('with');
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('mine');

  const { data: friendUser } = useQuery({
    queryKey: ['public-profile', friendId],
    queryFn: async () => {
      const { data, error } = await supabase.from('public_profiles').select('*').eq('id', friendId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!friendId,
  });

  const { data: myItems = [], isLoading: loadingMine } = useQuery({
    queryKey: ['user-collection-compare', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', currentUser.id)
        .eq('status', 'collected');
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const { data: friendItems = [], isLoading: loadingFriend } = useQuery({
    queryKey: ['user-collection-compare', friendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', friendId)
        .eq('status', 'collected');
      if (error) throw error;
      return data;
    },
    enabled: !!friendId,
  });

  const { data: sharedCans = [] } = useQuery({
    queryKey: ['shared-cans-compare'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    if (!sc) return item.can_rarity || null;
    const conf = getConfidence(sc.total_votes);
    return conf === 'unrated' ? null : getDisplayRarity(sc);
  };

  const myCanIds = useMemo(() => new Set(myItems.map(i => i.can_id)), [myItems]);
  const friendCanIds = useMemo(() => new Set(friendItems.map(i => i.can_id)), [friendItems]);

  // Sets
  const onlyMine = useMemo(() => myItems.filter(i => !friendCanIds.has(i.can_id)), [myItems, friendCanIds]);
  const onlyTheirs = useMemo(() => friendItems.filter(i => !myCanIds.has(i.can_id)), [friendItems, myCanIds]);
  const inCommon = useMemo(() => myItems.filter(i => friendCanIds.has(i.can_id)), [myItems, friendCanIds]);

  const tabItems = { mine: onlyMine, theirs: onlyTheirs, both: inCommon };
  const displayItems = tabItems[tab] || [];

  const isLoading = loadingMine || loadingFriend;

  // Neutral identity colors, not win/loss — "theirs" isn't a deficit, it's
  // just cans that belong to the other collector.
  const tabColors = {
    mine: 'bg-primary/10 border-primary/30 text-primary',
    theirs: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    both: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  };
  const activeTabColors = {
    mine: 'bg-primary/20 border-primary/50 text-primary',
    theirs: 'bg-slate-500/20 border-slate-400/50 text-slate-300',
    both: 'bg-amber-500/20 border-amber-400/50 text-amber-300',
  };

  const myName = currentUser?.user_metadata?.full_name || 'Me';
  const friendName = friendUser?.full_name || 'Friend';

  if (!friendId) {
    return (
      <div className="min-h-screen bg-background pb-10 flex flex-col items-center justify-center px-8 text-center gap-4">
        <GitCompare className="w-12 h-12 text-muted-foreground/20" />
        <div>
          <p className="text-sm font-display font-semibold text-foreground">No collector selected</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Open another collector's profile and tap "Compare" to see how your collections stack up.</p>
        </div>
        <Button onClick={() => navigate(-1)} variant="outline" className="font-mono text-xs">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GitCompare className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-display font-bold text-foreground">Collection Comparison</h1>
            <p className="text-[10px] font-mono text-muted-foreground truncate">{myName} vs {friendName}</p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger
            className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="What this screen shows"
          >
            <Info className="w-4 h-4" />
          </PopoverTrigger>
          <PopoverContent className="w-64 text-xs font-mono leading-relaxed" side="bottom" align="end">
            <p className="font-semibold text-foreground mb-1">Collection Comparison</p>
            <p className="text-muted-foreground">
              Shows which collected cans are only in your vault, only in {friendName}'s, or in both. Useful for spotting trade opportunities.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Summary stats */}
        {!isLoading && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold text-primary">{onlyMine.length}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Only Mine</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold text-amber-400">{inCommon.length}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">In Common</p>
            </div>
            <div className="bg-slate-500/5 border border-slate-500/20 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold text-slate-400">{onlyTheirs.length}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Only Theirs</p>
            </div>
          </div>
        )}

        {/* Segmented filter, not a tab set — matches the aria-pressed
            pattern the rest of the app uses for this exact interaction
            (Home's brand filter, CollectorsLeaderboard's metric toggle),
            not role="tab"/tablist, which implies arrow-key navigation
            between options that none of these buttons actually implement. */}
        <div aria-label="Compare view" className="flex gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 h-11 flex items-center justify-center rounded-xl border text-[11px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === t.key ? activeTabColors[t.key] : tabColors[t.key]
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && displayItems.length === 0 && (
          <div className="flex flex-col items-center py-14 gap-3">
            <Package className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm font-mono text-muted-foreground">
              {tab === 'both' ? 'No cans in common' : tab === 'mine' ? `${friendName} has all your cans too!` : `${friendName} has no exclusive cans`}
            </p>
          </div>
        )}

        {/* Positive reframing for "Only Theirs" — trade opportunity, not a deficit */}
        {!isLoading && tab === 'theirs' && displayItems.length > 0 && (
          <p className="text-[11px] font-mono text-muted-foreground -mt-1">
            Cans {friendName} has that you don't — potential trade targets.
          </p>
        )}

        {/* Grid */}
        {!isLoading && displayItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {displayItems.map(item => {
              const sc = sharedCansMap[item.can_id];
              const rarity = getEffectiveRarity(item);
              const imageUrl = item.can_image_url || sc?.image_url;
              const borderColor = tab === 'mine' ? 'border-primary/30' : tab === 'theirs' ? 'border-slate-500/30' : 'border-amber-500/30';
              return (
                <div key={item.id} className={cn('bg-card border rounded-xl overflow-hidden', borderColor)}>
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
        )}
      </div>
    </div>
  );
}
