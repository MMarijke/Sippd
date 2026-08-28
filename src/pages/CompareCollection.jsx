import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, GitCompare, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RarityBadge from '@/components/shared/RarityBadge';
import CanImageBox from '@/components/shared/CanImageBox';
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

  const tabColors = {
    mine: 'bg-green-500/10 border-green-500/30 text-green-400',
    theirs: 'bg-red-500/10 border-red-500/30 text-red-400',
    both: 'bg-primary/10 border-primary/30 text-primary',
  };
  const activeTabColors = {
    mine: 'bg-green-500/20 border-green-400/50 text-green-300',
    theirs: 'bg-red-500/20 border-red-400/50 text-red-300',
    both: 'bg-primary/20 border-primary/50 text-primary',
  };

  const myName = currentUser?.user_metadata?.full_name || 'Me';
  const friendName = friendUser?.full_name || 'Friend';

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
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Summary stats */}
        {!isLoading && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold text-green-400">{onlyMine.length}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Only Mine</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold text-primary">{inCommon.length}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">In Common</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-xl font-display font-bold text-red-400">{onlyTheirs.length}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Only Theirs</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 py-2 rounded-xl border text-[11px] font-mono transition-colors',
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

        {/* Grid */}
        {!isLoading && displayItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {displayItems.map(item => {
              const sc = sharedCansMap[item.can_id];
              const rarity = getEffectiveRarity(item);
              const imageUrl = item.can_image_url || sc?.image_url;
              const borderColor = tab === 'mine' ? 'border-green-500/30' : tab === 'theirs' ? 'border-red-500/30' : 'border-primary/20';
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
