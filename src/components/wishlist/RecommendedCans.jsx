import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CanImageBox from '@/components/shared/CanImageBox';
import RarityBadge from '@/components/shared/RarityBadge';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';

// Per brand, enough of the catalog to rank from without loading all of it.
const PER_BRAND_LIMIT = 300;

export default function RecommendedCans({ collection }) {
  const navigate = useNavigate();

  // Brands I actively collect (status = collected)
  const brandList = useMemo(
    () => [...new Set(
      collection.filter(i => i.status === 'collected').map(i => i.can_brand).filter(Boolean)
    )].sort(),
    [collection]
  );

  // The catalog for those brands, asked of the server. This used to come
  // from the page's newest-500 catalog copy, so once the catalog outgrew it
  // the older cans of your brands could never be recommended.
  const { data: sharedCans = [] } = useQuery({
    queryKey: ['shared-cans', 'by-brand', brandList],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .in('brand', brandList)
        .order('total_votes', { ascending: false })
        .limit(PER_BRAND_LIMIT);
      if (error) throw error;
      return data ?? [];
    },
    enabled: brandList.length > 0,
  });

  const recommendations = useMemo(() => {
    if (!collection.length || !sharedCans.length) return [];

    const collectedBrands = new Set(brandList);

    // Can IDs I already own or have wishlisted
    const myCanIds = new Set(collection.map(i => i.can_id));

    // From SharedCans, find cans from my brands that I don't have
    const candidates = sharedCans.filter(sc =>
      sc.brand && collectedBrands.has(sc.brand) && !myCanIds.has(sc.id)
    );

    // Sort by rarity (rarest first), then by community votes (most voted first)
    const RARITY_RANK = { 'Legendary': 5, 'Ultra Rare': 4, 'Rare': 3, 'Uncommon': 2, 'Common': 1 };
    candidates.sort((a, b) => {
      const ra = RARITY_RANK[getDisplayRarity(a)] || 0;
      const rb = RARITY_RANK[getDisplayRarity(b)] || 0;
      if (rb !== ra) return rb - ra;
      return (b.total_votes || 0) - (a.total_votes || 0);
    });

    return candidates.slice(0, 10);
  }, [collection, sharedCans, brandList]);

  if (!recommendations.length) return null;

  return (
    <div className="px-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <p className="text-2xs font-mono text-muted-foreground uppercase tracking-widest">Recommended for You</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
        {recommendations.map(sc => {
          const conf = getConfidence(sc.total_votes);
          const rarity = conf === 'unrated' ? null : getDisplayRarity(sc);
          return (
            <button
              key={sc.id}
              type="button"
              className="flex-shrink-0 w-32 bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors text-left"
              onClick={() => navigate(`/can/${sc.id}`)}
            >
              <CanImageBox
                imageUrl={sc.image_url}
                alt={sc.name}
                className="aspect-square"
                iconSize="w-7 h-7"
              />
              <div className="p-2 space-y-1">
                <p className="text-2xs font-mono text-muted-foreground truncate">{sc.brand}</p>
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{sc.name}</p>
                {rarity
                  ? <RarityBadge rarity={rarity} size="sm" />
                  : <span className="text-2xs font-mono text-muted-foreground">? ? ?</span>
                }
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}