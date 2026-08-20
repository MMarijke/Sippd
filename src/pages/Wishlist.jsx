import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Search, ScanLine, CheckCircle2, Trash2, ChevronDown, ChevronRight, Bookmark } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import CanImageBox from '@/components/shared/CanImageBox';
import RarityBadge from '@/components/shared/RarityBadge';
import { getDisplayRarity } from '@/lib/rarityConsensus';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import RecommendedCans from '@/components/wishlist/RecommendedCans';

export default function Wishlist() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [collectedIds, setCollectedIds] = useState(new Set());
  const [collapsedBrands, setCollapsedBrands] = useState(new Set());
  const queryClient = useQueryClient();

  const { data: collection = [], isLoading } = useQuery({
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
  });

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const wishlist = useMemo(
    () => collection.filter(i => i.status === 'wishlist'),
    [collection]
  );

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    return sc ? getDisplayRarity(sc) : (item.can_rarity || 'Common');
  };

  const filtered = useMemo(() => {
    if (searchQuery.length < 2) return wishlist;
    const q = searchQuery.toLowerCase();
    return wishlist.filter(i =>
      i.can_name?.toLowerCase().includes(q) ||
      i.can_brand?.toLowerCase().includes(q)
    );
  }, [wishlist, searchQuery]);

  // Group by brand
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const brand = item.can_brand || 'Unknown Brand';
      if (!map[brand]) map[brand] = [];
      map[brand].push(item);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleBrand = (brand) => {
    setCollapsedBrands(prev => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  };

  const moveToCollection = async (item) => {
    setCollectedIds(prev => new Set(prev).add(item.id));
    const { error } = await supabase
      .from('user_collection')
      .update({ status: 'collected' })
      .eq('id', item.id)
      .eq('owner_id', user.id);
    if (error) {
      toast.error('Failed to move to collection');
      setCollectedIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['user-collection', user?.id] });
    toast.success(`${item.can_name} added to your collection!`);
  };

  const removeFromWishlist = async (item) => {
    const { error } = await supabase
      .from('user_collection')
      .delete()
      .eq('id', item.id)
      .eq('owner_id', user.id);
    if (error) {
      toast.error('Failed to remove from wishlist');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['user-collection', user?.id] });
    toast.success('Removed from wishlist');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Wishlist"
        subtitle={`${wishlist.length} cans wanted`}
        action={
          <Link to="/scan">
            <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5">
              <ScanLine className="w-4 h-4" /> Add
            </Button>
          </Link>
        }
      />

      {/* Search */}
      <div className="px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search wishlist..."
            className="pl-9 bg-secondary border-border font-body"
          />
        </div>
      </div>

      {!isLoading && <RecommendedCans collection={collection} sharedCans={sharedCans} />}

      <div className="px-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : wishlist.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3 text-center">
            <Bookmark className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-display font-semibold text-foreground">Nothing on your wishlist</p>
            <p className="text-xs font-mono text-muted-foreground">Scan a can and save it as "Wishlist" to track ones you want</p>
            <Link to="/scan">
              <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground mt-1">
                <ScanLine className="w-4 h-4" /> Start Scanning
              </Button>
            </Link>
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm font-mono text-muted-foreground text-center py-10">No results for "{searchQuery}"</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([brand, items]) => {
              const isCollapsed = collapsedBrands.has(brand);
              return (
                <div key={brand} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {/* Brand header */}
                  <button
                    onClick={() => toggleBrand(brand)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-display font-bold text-foreground">{brand}</span>
                      <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>

                  {/* Items */}
                  {!isCollapsed && (
                    <div className="divide-y divide-border border-t border-border">
                      {items.map(item => {
                        const rarity = getEffectiveRarity(item);
                        const justCollected = collectedIds.has(item.id);
                        const sc = sharedCansMap[item.can_id];
                        const imageUrl = item.can_image_url || sc?.image_url;
                        return (
                          <div key={item.id} className={cn('flex items-center gap-3 px-4 py-3 transition-colors', justCollected && 'opacity-50')}>
                            {/* Image */}
                            <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden">
                              <CanImageBox imageUrl={imageUrl} bgColor={item.can_bg_color} alt={item.can_name} className="w-full h-full" iconSize="w-5 h-5" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate leading-tight">{item.can_name}</p>
                              {item.can_flavour && (
                                <p className="text-[10px] font-mono text-muted-foreground truncate">{item.can_flavour}</p>
                              )}
                              <div className="mt-0.5">
                                <RarityBadge rarity={rarity} size="sm" />
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => moveToCollection(item)}
                                disabled={justCollected}
                                title="Move to collection"
                                className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeFromWishlist(item)}
                                title="Remove"
                                className="w-8 h-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
