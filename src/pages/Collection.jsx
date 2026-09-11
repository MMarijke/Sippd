import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ScanLine, PackageOpen, X, AlertCircle, RefreshCw } from 'lucide-react';
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
import { toast } from 'sonner';

const PAGE_SIZE = 60;

// Matches FilterBar's own SelectItem labels for Status.
const STATUS_LABELS = { collected: 'In Vault', wishlist: 'Wishlist', duplicate: 'Duplicates' };

export default function Collection() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initial state reads from the URL once on mount so a bookmarked or
  // back-navigated link reproduces the exact same search/filter/sort/view
  // combination, not just an empty default state.
  const [viewMode, setViewMode] = useState(() => (searchParams.get('view') === 'list' ? 'list' : 'grid'));
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || 'all',
    rarity: searchParams.get('rarity') || 'all',
    favourites: searchParams.get('fav') === '1',
    sort: searchParams.get('sort') || 'date_desc',
  }));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [crateTarget, setCrateTarget] = useState(null);
  const { user } = useAuth();
  const streak = useStreak();
  const location = useLocation();
  const navigate = useNavigate();

  // Keep the URL in sync with search/filter/sort/view so back-navigation
  // (e.g. from a can's detail page) and bookmarked/shared links land back
  // on the same filtered view instead of resetting to the unfiltered
  // default. Only non-default values are written, keeping a plain visit
  // to /collection free of query-string clutter. `replace` avoids pushing
  // a new history entry for every keystroke/filter change.
  useEffect(() => {
    const next = {};
    if (searchQuery) next.q = searchQuery;
    if (filters.status !== 'all') next.status = filters.status;
    if (filters.rarity !== 'all') next.rarity = filters.rarity;
    if (filters.favourites) next.fav = '1';
    if (filters.sort !== 'date_desc') next.sort = filters.sort;
    if (viewMode !== 'grid') next.view = viewMode;
    setSearchParams(next, { replace: true });
  }, [searchQuery, filters, viewMode, setSearchParams]);

  // Reset to the first page whenever the filtered set's criteria change —
  // otherwise switching filters could leave a large stale render count
  // pointed at a now-different, possibly much smaller result set.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, searchQuery]);

  // AddCanForm can hand off the can it just created via navigation state so
  // the "add to a crate?" offer survives the redirect to this page. Carries
  // the current search string forward so this doesn't clear an in-progress
  // filtered view (not that this particular hand-off currently arrives with
  // one, but there's no reason for it to silently drop one if it ever does).
  useEffect(() => {
    if (location.state?.addedCan) {
      setCrateTarget(location.state.addedCan);
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} });
    }
  }, [location.state]);

  const {
    data: collection = [],
    isLoading: isLoadingCollection,
    isError: isCollectionError,
    refetch: refetchCollection,
  } = useQuery({
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

  const {
    data: sharedCans = [],
    isLoading: isLoadingSharedCans,
    isError: isSharedCansError,
    refetch: refetchSharedCans,
  } = useQuery({
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

  const {
    data: votes = [],
    isLoading: isLoadingVotes,
    isError: isVotesError,
    refetch: refetchVotes,
  } = useQuery({
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

  // Combined so a can can't render with its fallback cached rarity (no
  // consensus data yet) during a window the page's own spinner has already
  // stopped covering — previously only the collection query gated isLoading,
  // so sharedCans/votes could still be in flight after the spinner cleared.
  const isLoading = isLoadingCollection || isLoadingSharedCans || isLoadingVotes;

  // A failed fetch here would otherwise render identically to a genuinely
  // empty collection (filtered.length === 0) — misleading an established
  // collector into thinking their vault is empty. One combined flag/retry
  // avoids toasting/retrying three times for what's usually one root cause.
  const hasLoadError = isCollectionError || isSharedCansError || isVotesError;
  const retryCollection = () => {
    refetchCollection();
    refetchSharedCans();
    refetchVotes();
  };

  useEffect(() => {
    if (hasLoadError) toast.error('Could not load your collection');
  }, [hasLoadError]);

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

  // Sort is excluded on purpose — it reorders results, it never excludes
  // them, so it can't be the reason a search+filter combination landed on
  // zero results and doesn't need a "clear" affordance of its own.
  const hasActiveFilters = filters.status !== 'all' || filters.rarity !== 'all' || filters.favourites || searchQuery.length >= 2;
  const clearFilters = () => {
    setFilters(prev => ({ ...prev, status: 'all', rarity: 'all', favourites: false }));
    setSearchQuery('');
  };

  // Consolidates 4 separate controls into one scannable, removable summary
  // — previously the only way to see what's currently filtering results was
  // to inspect every control individually, and the only way to clear any of
  // it was buried inside the zero-results empty state. Sort excluded, same
  // reasoning as hasActiveFilters above: it reorders, it never excludes.
  const activeFilterChips = [
    filters.status !== 'all' && {
      key: 'status',
      label: STATUS_LABELS[filters.status] || filters.status,
      onRemove: () => setFilters(prev => ({ ...prev, status: 'all' })),
    },
    filters.rarity !== 'all' && {
      key: 'rarity',
      label: filters.rarity,
      onRemove: () => setFilters(prev => ({ ...prev, rarity: 'all' })),
    },
    filters.favourites && {
      key: 'favourites',
      label: 'Favourites',
      onRemove: () => setFilters(prev => ({ ...prev, favourites: false })),
    },
    searchQuery.length >= 2 && {
      key: 'search',
      label: `"${searchQuery}"`,
      onRemove: () => setSearchQuery(''),
    },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}

      {/* Header zone: title + search only, on Home's own hero-zone gradient
          layer — this is the app's other primary-nav destination, and it
          previously carried none of Home's glass/gradient/glow language
          (see .impeccable/critique/2026-09-11T11-52-01Z, P1). Scoped the
          same way Home scopes its own hero zone: FilterBar and results sit
          outside this wrapper, on the plain background. */}
      <div className="relative">
        <div className="home-gradient-bg-layer" aria-hidden="true" />
        <div className="relative z-10 space-y-4">
          <PageHeader
            title="Your Haul"
            subtitle={`${collection.length} cans total`}
            action={
              <div className="flex items-center gap-2">
                <Link to="/crates">
                  <Button size="sm" variant="outline" className="h-11 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                    <PackageOpen className="w-4 h-4" /> Crates
                  </Button>
                </Link>
                <Link to="/scan">
                  <Button size="sm" variant="outline" className="h-11 font-mono text-xs gap-1.5">
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
                aria-label="Search your collection"
                className="h-11 pl-9 bg-secondary border-border font-body"
              />
            </div>
          </div>
        </div>
      </div>

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {activeFilterChips.length > 0 && (
        <div className="px-5 flex flex-wrap items-center gap-2">
          {activeFilterChips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-mono"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                aria-label={`Remove ${chip.label} filter`}
                className="p-1.5 -m-1 rounded-full hover:bg-primary/20 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="h-8 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="px-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hasLoadError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load your collection"
            description="Check your connection and try again."
            action={
              <Button
                variant="outline"
                className="h-11 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={retryCollection}
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No cans found"
            description={collection.length === 0 ? "Start scanning to build your vault!" : "Try adjusting your filters"}
            action={
              collection.length === 0 ? (
                <Button asChild className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground">
                  <Link to="/scan">
                    <ScanLine className="w-4 h-4" /> Add First Can
                  </Link>
                </Button>
              ) : hasActiveFilters ? (
                <Button
                  variant="outline"
                  className="h-11 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={clearFilters}
                >
                  <X className="w-4 h-4" /> Clear Filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-3">
                {filtered.slice(0, visibleCount).map(item => (
                  <CanCard
                    key={item.id}
                    can={item}
                    to={`/can/${item.can_id}`}
                    showStatus
                    sharedCan={sharedCansMap[item.can_id]}
                    onAddToCrate={() => setCrateTarget(item)}
                  />
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
                  className="h-11 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10"
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
