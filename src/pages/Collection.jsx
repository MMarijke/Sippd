import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Search, ScanLine, PackageOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/collection/FilterBar';
import CanCard from '@/components/shared/CanCard';
import CanListItem from '@/components/collection/CanListItem';
import EmptyState from '@/components/shared/EmptyState';
import { getDisplayRarity, RARITY_ORDER } from '@/lib/rarityConsensus';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';
import { useStreak } from '@/lib/useStreak';

export default function Collection() {
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: 'all', rarity: 'all', favourites: false, sort: 'date_desc' });
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const streak = useStreak();

  const { data: collection = [], isLoading } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: () => base44.entities.UserCollection.list('-created_date'),
    enabled: !!user?.id,
  });

  const { data: sharedCans = [] } = useQuery({
    queryKey: ['shared-cans'],
    queryFn: () => base44.entities.SharedCan.list('-created_date', 500),
  });

  const { data: votes = [] } = useQuery({
    queryKey: ['my-votes', user?.id],
    queryFn: () => base44.entities.RarityVote.list('-created_date', 500),
    enabled: !!user?.id,
  });

  const sharedCansMap = Object.fromEntries(sharedCans.map(c => [c.id, c]));

  const achievements = computeAchievements(collection, streak, votes.length, user?.created_date);
  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements);

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    return sc ? getDisplayRarity(sc) : (item.can_rarity || 'Common');
  };

  const filtered = collection
    .filter(item => {
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.rarity !== 'all' && getEffectiveRarity(item) !== filters.rarity) return false;
      if (filters.favourites && !item.is_favourite) return false;
      if (searchQuery.length >= 2) {
        const q = searchQuery.toLowerCase();
        return (
          item.can_name?.toLowerCase().includes(q) ||
          item.can_brand?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const sort = filters.sort || 'date_desc';
      if (sort === 'date_asc') return new Date(a.created_date) - new Date(b.created_date);
      if (sort === 'date_desc') return new Date(b.created_date) - new Date(a.created_date);
      if (sort === 'brand_asc') return (a.can_brand || '').localeCompare(b.can_brand || '');
      if (sort === 'brand_desc') return (b.can_brand || '').localeCompare(a.can_brand || '');
      if (sort === 'rarity_desc') return RARITY_ORDER.indexOf(getEffectiveRarity(b)) - RARITY_ORDER.indexOf(getEffectiveRarity(a));
      if (sort === 'rarity_asc') return RARITY_ORDER.indexOf(getEffectiveRarity(a)) - RARITY_ORDER.indexOf(getEffectiveRarity(b));
      return 0;
    });

  return (
    <div className="space-y-4">
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}
      <PageHeader
        title="Your Haul"
        subtitle={`${collection.length} cans total`}
        action={
          <div className="flex items-center gap-2">
            <Link to="/crates">
              <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                <PackageOpen className="w-4 h-4" /> Crates
              </Button>
            </Link>
            <Link to="/scan">
              <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5">
                <ScanLine className="w-4 h-4" /> Add
              </Button>
            </Link>
          </div>
        }
      />

      {/* Search */}
      <div className="px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search your collection..."
            className="pl-9 bg-secondary border-border font-body"
          />
        </div>
      </div>

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Results */}
      <div className="px-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No Cans Found"
            description={collection.length === 0 ? "Start scanning to build your vault!" : "Try adjusting your filters"}
            action={
              collection.length === 0 && (
                <Link to="/scan">
                  <Button className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground">
                    <ScanLine className="w-4 h-4" /> Add First Can
                  </Button>
                </Link>
              )
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => (
              <Link key={item.id} to={`/can/${item.can_id}`}>
                <CanCard
                  can={item}
                  showStatus
                  sharedCan={sharedCansMap[item.can_id]}
                />
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <CanListItem key={item.id} item={item} sharedCan={sharedCansMap[item.can_id]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}