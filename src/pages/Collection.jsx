import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ScanLine, PackageOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/collection/FilterBar';
import CanCard from '@/components/shared/CanCard';
import CanListItem from '@/components/collection/CanListItem';
import EmptyState from '@/components/shared/EmptyState';
import AddToCrateSheet from '@/components/crates/AddToCrateSheet';
import { getDisplayRarity, RARITY_ORDER } from '@/lib/rarityConsensus';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';
import { useStreak } from '@/lib/useStreak';

const PAGE_SIZE = 60;

export default function Collection() {
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: 'all', rarity: 'all', favourites: false, sort: 'date_desc' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [crateTarget, setCrateTarget] = useState(null);
  const { user } = useAuth();
  const streak = useStreak();
  const location = useLocation();
  const navigate = useNavigate();

  // Reset to the first page whenever the filtered set's criteria change —
  // otherwise switching filters could leave a large stale render count
  // pointed at a now-different, possibly much smaller result set.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, searchQuery]);

  // AddCanForm can hand off the can it just created via navigation state so
  // the "add to a crate?" offer survives the redirect to this page.
  useEffect(() => {
    if (location.state?.addedCan) {
      setCrateTarget(location.state.addedCan);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

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

  const achievements = computeAchievements(collection, streak, votes.length, user?.created_at);
  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements);

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    return sc ? getDisplayRarity(sc) : (item.can_rarity || 'Common');
  };

  // Was recomputing this full filter+sort pass on every keystroke in the
  // search box, over the entire collection — the page most likely to hold
  // hundreds of items. sharedCansMap is memoized above specifically so this
  // dependency is stable across renders that don't actually change it.
  const filtered = useMemo(() => collection
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
      if (sort === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
      if (sort === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
      if (sort === 'brand_asc') return (a.can_brand || '').localeCompare(b.can_brand || '');
      if (sort === 'brand_desc') return (b.can_brand || '').localeCompare(a.can_brand || '');
      if (sort === 'rarity_desc') return RARITY_ORDER.indexOf(getEffectiveRarity(b)) - RARITY_ORDER.indexOf(getEffectiveRarity(a));
      if (sort === 'rarity_asc') return RARITY_ORDER.indexOf(getEffectiveRarity(a)) - RARITY_ORDER.indexOf(getEffectiveRarity(b));
      return 0;
    }), [collection, filters, searchQuery, sharedCansMap]);

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

      <div className="px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search your collection…"
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

      <div className="px-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No cans found"
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
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-3">
                {filtered.slice(0, visibleCount).map(item => (
                  <Link key={item.id} to={`/can/${item.can_id}`}>
                    <CanCard
                      can={item}
                      showStatus
                      sharedCan={sharedCansMap[item.can_id]}
                      onAddToCrate={() => setCrateTarget(item)}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.slice(0, visibleCount).map(item => (
                  <CanListItem
                    key={item.id}
                    item={item}
                    sharedCan={sharedCansMap[item.can_id]}
                    onAddToCrate={() => setCrateTarget(item)}
                  />
                ))}
              </div>
            )}

            {filtered.length > visibleCount && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                >
                  Load More ({filtered.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {crateTarget && (
        <AddToCrateSheet can={crateTarget} onClose={() => setCrateTarget(null)} />
      )}
    </div>
  );
}
