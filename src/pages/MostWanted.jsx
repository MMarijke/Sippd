import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Star, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import RarityBadge from '@/components/shared/RarityBadge';
import CanImageBox from '@/components/shared/CanImageBox';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { useFavourite } from '@/hooks/useFavourite';
import { toast } from 'sonner';
import { useUserCollection } from '@/hooks/useUserCollection';
import { useOffline } from '@/lib/offline/OfflineProvider';
import { addCan } from '@/lib/offline/outbox';

const MEDAL_COLORS = [
  'text-medal-gold border-medal-gold/40 bg-medal-gold/5',
  'text-medal-silver border-medal-silver/40 bg-medal-silver/5',
  'text-medal-bronze border-medal-bronze/40 bg-medal-bronze/5',
];

// Rows are heavier than Collection's grid cards (medal styling, favourite
// button + count), so a smaller page than Collection's PAGE_SIZE=60 keeps
// first paint light while still rendering enough to feel like a real list.
const PAGE_SIZE = 30;

export default function MostWanted() {
  const navigate = useNavigate();
  const { write } = useOffline();
  const { toggleFavourite } = useFavourite();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const {
    data: sharedCans = [],
    isLoading,
    isError: isSharedCansError,
    refetch: refetchSharedCans,
  } = useQuery({
    // Its own key: this used to share ['shared-cans'] with pages caching a
    // differently-ordered list, so whichever loaded first answered both.
    // Filtered on the server, so the 500 are the 500 most-favourited cans
    // rather than favourites hunted for inside an arbitrary slice.
    queryKey: ['shared-cans', 'most-wanted'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .gte('community_favourites', 1)
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
  } = useUserCollection();

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
    // Offline-capable; no rarity vote for a plain wishlist add (skipVote).
    mutationFn: (can) => write((db, userId) => addCan(db, {
      userId,
      row: {
        can_id: can.id,
        status: 'wishlist',
        can_name: can.name,
        can_brand: can.brand,
        can_image_url: can.image_url,
        can_rarity: can.consensus_rarity || can.rarity || 'Common',
        can_flavour: can.flavour,
        can_edition: can.edition,
      },
      catalog: { canId: can.id, skipVote: true },
    })),
    onSuccess: (_, can) => {
      toast.success(`Added ${can.name} to wishlist!`);
    },
    onError: (error, can) => {
      toast.error(`Failed to add ${can.name} to wishlist: ` + (error?.message || 'Unknown error'));
    },
  });

  // Row tap is pure navigation now — it used to silently insert a wishlist
  // row for an unowned can with zero confirmation, the one interactive
  // surface in this tablist that mutated data on a bare tap while the other
  // two tabs (Collectors/Regional) are read-only. CanDetail already renders
  // a shared can gracefully whether or not the viewer owns it (falls back
  // to shared_cans data, hides the owner-only actions), so it's a safe
  // target regardless of ownership. The actual write now lives only behind
  // the explicit "Add to Wishlist" button below.
  const handleCanTap = (can) => {
    navigate(`/can/${can.id}`);
  };

  const handleAddToWishlist = (can) => {
    if (isLoadingMyCollection || isMyCollectionError) {
      // Ownership status isn't known yet (still loading) or couldn't be
      // confirmed (fetch failed) — myCollectionMap would silently read as
      // {} in both cases, which would let this fire for a can the user
      // already owns.
      toast.error("Couldn't check your collection — try again in a moment.");
      return;
    }
    addToWishlist.mutate(can);
  };

  if (isLoading) {
    return (
      // Skeleton rows like the Collectors and Regional boards, so switching
      // tabs doesn't swap loading languages.
      <div className="px-5 space-y-2" aria-busy="true" aria-label="Loading Most Wanted">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-card/40 border border-border/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isSharedCansError) {
    return (
      <div className="px-5">
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
      <div className="px-5">
        <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center">
          <Star className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Nothing's trending yet</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Be the first to favourite a can!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-2">
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

            {/* Same action as the name button beside it, which carries the
                accessible name -- this one is a bigger touch target only,
                so it's kept out of the tab order and the a11y tree rather
                than being a second, unnamed stop for the same thing. */}
            <button
              onClick={() => handleCanTap(can)}
              tabIndex={-1}
              aria-hidden="true"
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
              <p className="text-2xs font-mono text-primary/70 truncate">{can.brand}</p>
              <div className="mt-1">
                <RarityBadge rarity={rarity} />
              </div>
            </button>

            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              {myItem ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
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
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToWishlist(can);
                  }}
                  disabled={addToWishlist.isPending}
                  aria-label={`Add ${can.name} to wishlist`}
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <span className="text-2xs font-mono text-muted-foreground tabular-nums">
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
