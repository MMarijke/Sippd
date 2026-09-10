import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Star, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import RarityBadge from '@/components/shared/RarityBadge';
import CanImageBox from '@/components/shared/CanImageBox';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { useFavourite } from '@/hooks/useFavourite';
import { toast } from 'sonner';

const MEDAL_COLORS = [
  'text-yellow-400 border-yellow-400/40 bg-yellow-400/5',
  'text-slate-300 border-slate-300/40 bg-slate-300/5',
  'text-amber-600 border-amber-600/40 bg-amber-600/5',
];

// Rows are heavier than Collection's grid cards (medal styling, favourite
// button + count), so a smaller page than Collection's PAGE_SIZE=60 keeps
// first paint light while still rendering enough to feel like a real list.
const PAGE_SIZE = 30;

export default function MostWanted() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toggleFavourite } = useFavourite();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const {
    data: sharedCans = [],
    isLoading,
    isError: isSharedCansError,
    refetch: refetchSharedCans,
  } = useQuery({
    queryKey: ['shared-cans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .order('community_favourites', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const {
    data: myCollection = [],
    isLoading: isLoadingMyCollection,
    isError: isMyCollectionError,
  } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (isSharedCansError) toast.error('Could not load Most Wanted');
    if (isMyCollectionError) toast.error('Could not check your collection');
  }, [isSharedCansError, isMyCollectionError]);

  const myCollectionMap = useMemo(
    () => Object.fromEntries(myCollection.map(c => [c.can_id, c])),
    [myCollection]
  );

  const ranked = useMemo(
    () => sharedCans
      .filter(c => (c.community_favourites || 0) >= 1)
      .sort((a, b) => (b.community_favourites || 0) - (a.community_favourites || 0)),
    [sharedCans]
  );

  const addToWishlist = useMutation({
    mutationFn: async (can) => {
      const { error } = await supabase.from('user_collection').insert({
        owner_id: user.id,
        can_id: can.id,
        status: 'wishlist',
        can_name: can.name,
        can_brand: can.brand,
        can_image_url: can.image_url,
        can_rarity: can.consensus_rarity || can.rarity || 'Common',
        can_flavour: can.flavour,
        can_edition: can.edition,
      });
      if (error) throw error;
    },
    onSuccess: (_, can) => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      toast.success(`Added ${can.name} to wishlist!`);
    },
    onError: (error, can) => {
      toast.error(`Failed to add ${can.name} to wishlist: ` + (error?.message || 'Unknown error'));
    },
  });

  const handleCanTap = (can) => {
    const myItem = myCollectionMap[can.id];
    if (myItem) {
      navigate(`/can/${can.id}`);
    } else if (isLoadingMyCollection || isMyCollectionError) {
      // Ownership status isn't known yet (still loading) or couldn't be
      // confirmed (fetch failed) — myCollectionMap would silently read as
      // {} in both cases, which previously made an already-owned can look
      // not-owned and fired a wishlist-add instead of navigating to it.
      toast.error("Couldn't check your collection — try again in a moment.");
    } else {
      addToWishlist.mutate(can);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSharedCansError) {
    return (
      <div className="px-5 pt-4">
        <div className="bg-card border border-destructive/30 rounded-2xl p-10 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Couldn't load Most Wanted</p>
          <Button
            variant="outline"
            size="sm"
            className="h-11 mt-4 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => refetchSharedCans()}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="px-5 pt-4">
        <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center">
          <Star className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">No favourites yet</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Be the first to favourite a can!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 space-y-2">
      {ranked.slice(0, visibleCount).map((can, i) => {
        const myItem = myCollectionMap[can.id];
        const isMedal = i < 3;
        const confidence = getConfidence(can.total_votes);
        const rarity = confidence === 'unrated' ? '???' : getDisplayRarity(can);
        const isFav = myItem?.is_favourite || false;

        return (
          <div
            key={can.id}
            className={cn(
              'flex items-center gap-3 p-3 bg-card rounded-xl border transition-all',
              isMedal ? MEDAL_COLORS[i] : 'border-border'
            )}
          >
            <div className="w-7 flex-shrink-0 text-center">
              {isMedal ? (
                <span className={cn('text-base font-display font-bold', MEDAL_COLORS[i].split(' ')[0])}>
                  #{i + 1}
                </span>
              ) : (
                <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
              )}
            </div>

            <button
              onClick={() => handleCanTap(can)}
              className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
            >
              <CanImageBox
                imageUrl={can.image_url}
                alt={can.name}
                className="w-full h-full"
                iconSize="w-5 h-5"
              />
            </button>

            <button
              onClick={() => handleCanTap(can)}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-sm font-semibold text-foreground truncate">{can.name}</p>
              <p className="text-[11px] font-mono text-primary/70 truncate">{can.brand}</p>
              <div className="mt-1">
                <RarityBadge rarity={rarity} />
              </div>
            </button>

            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!myItem) {
                    toast.info('Add this can to your collection first to favourite it.');
                    return;
                  }
                  toggleFavourite({ collectionItem: myItem, sharedCan: can });
                }}
                aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
                aria-pressed={isFav}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-colors',
                  isFav
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground hover:text-primary'
                )}
              >
                <Star className={cn('w-4 h-4', isFav && 'fill-primary')} />
              </button>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {can.community_favourites || 0}
              </span>
            </div>
          </div>
        );
      })}

      {ranked.length > visibleCount && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            className="h-11 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
          >
            Load More ({ranked.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
