import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSharedCansByIds } from '@/hooks/useSharedCansByIds';
import { useAuth } from '@/lib/AuthContext';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ScanLine, PackageOpen, X, AlertCircle, RefreshCw, CheckSquare, Star, PackagePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/collection/FilterBar';
import CanCard from '@/components/shared/CanCard';
import CanListItem from '@/components/collection/CanListItem';
import EmptyState from '@/components/shared/EmptyState';
import AddToCrateSheet from '@/components/crates/AddToCrateSheet';
import { getDisplayRarity } from '@/lib/rarityConsensus';
import { filterAndSortCollection } from '@/lib/filterCollection';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';
import { useStreak } from '@/lib/useStreak';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 60;

// Matches FilterBar's own SelectItem labels for Status.
const STATUS_LABELS = { collected: 'In Vault', wishlist: 'Wishlist', duplicate: 'Duplicates' };
const BEVERAGE_TYPE_LABELS = { energy_drink: 'Energy Drink', soft_drink: 'Soft Drink' };

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
    beverageType: searchParams.get('type') || 'all',
    favourites: searchParams.get('fav') === '1',
    sort: searchParams.get('sort') || 'date_desc',
  }));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [crateTarget, setCrateTarget] = useState(null);
  const [bulkCrateTargets, setBulkCrateTargets] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const { user } = useAuth();
  const streak = useStreak();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    if (filters.beverageType !== 'all') next.type = filters.beverageType;
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
  } = useSharedCansByIds(collection.map(i => i.can_id));

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
  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements, user?.id);

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    return sc ? getDisplayRarity(sc) : (item.can_rarity || 'Common');
  };

  // Was recomputing this full filter+sort pass on every keystroke in the
  // search box, over the entire collection — the page most likely to hold
  // hundreds of items. sharedCansMap is memoized above specifically so this
  // dependency is stable across renders that don't actually change it.
  // The actual filter/sort rules live in lib/filterCollection.js (unit
  // tested there) — this is just wiring this page's own state into it.
  const filtered = useMemo(
    () => filterAndSortCollection(collection, filters, searchQuery, getEffectiveRarity),
    [collection, filters, searchQuery, sharedCansMap]
  );

  // Sort is excluded on purpose — it reorders results, it never excludes
  // them, so it can't be the reason a search+filter combination landed on
  // zero results and doesn't need a "clear" affordance of its own.
  const hasActiveFilters = filters.status !== 'all' || filters.rarity !== 'all' || filters.beverageType !== 'all' || filters.favourites || searchQuery.length >= 2;
  // The sheet's Clear resets only what the sheet sets, not your search.
  const clearSheetFilters = () => setFilters(prev => ({ ...prev, status: 'all', rarity: 'all', beverageType: 'all', favourites: false }));
  const clearFilters = () => {
    setFilters(prev => ({ ...prev, status: 'all', rarity: 'all', beverageType: 'all', favourites: false }));
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
    filters.beverageType !== 'all' && {
      key: 'beverageType',
      label: BEVERAGE_TYPE_LABELS[filters.beverageType] || filters.beverageType,
      onRemove: () => setFilters(prev => ({ ...prev, beverageType: 'all' })),
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

  // Selection mode: was one-item-at-a-time for every crate/favourite action,
  // real friction for the "serious collector, hundreds of cans" persona this
  // page is explicitly built for. Cleared whenever the filtered set changes
  // (a selected item can scroll out of the current filter/search) so a
  // stale selection never silently acts on cans no longer visible.
  const selectedItems = useMemo(
    () => collection.filter(item => selectedIds.has(item.id)),
    [collection, selectedIds]
  );
  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    setSelectedIds(new Set());
  };
  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, searchQuery]);

  const bulkFavouriteMutation = useMutation({
    // Only calls toggle_favourite() for items not already favourited — a
    // naive "toggle everything selected" would flip an already-favourited
    // can back off, which reads as a bug ("I selected 5, favourited them,
    // and one got un-favourited") rather than the "favourite all of these"
    // action the button says it does.
    mutationFn: async (items) => {
      const targets = items.filter(item => !item.is_favourite);
      await Promise.all(targets.map(item =>
        supabase.rpc('toggle_favourite', { p_caller_id: user.id, p_collection_id: item.id })
          .then(({ error }) => { if (error) throw error; })
      ));
      return targets.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      queryClient.invalidateQueries({ queryKey: ['shared-cans'] });
      // Selection stays intact rather than auto-clearing — favouriting and
      // adding-to-crate are both real, plausible actions on the exact same
      // selection, and silently dropping it after the first one would force
      // re-selecting everything to do the second.
      toast.success(count > 0 ? `Favourited ${count} can${count === 1 ? '' : 's'}` : 'Already favourited');
    },
    onError: (error) => {
      toast.error('Failed to favourite selection: ' + (error.message || 'Unknown error'));
    },
  });

  return (
    <div className="space-y-4">
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}

      {/* Header zone: title + search + FilterBar, on Home's own hero-zone
          gradient layer — this is the app's other primary-nav destination,
          and it previously carried none of Home's glass/gradient/glow
          language (see .impeccable/critique/2026-09-11T11-52-01Z, P1).
          FilterBar is included so the fade reaches down as far as Home's
          equivalent hero zone (header+RarityHero+Score) does, rather than
          cutting off abruptly right after the search box. Results still
          sit outside this wrapper, on the plain background. */}
      <div className="relative">
        <div className="home-gradient-bg-layer" aria-hidden="true" />
        <div className="relative z-10 space-y-4">
          {/* Title and Scan only. Select and Crates moved to the count line
              above the grid: four header actions squeezed "Your Haul" to
              "You…" at 375px and to nothing at 320px (/impeccable critique). */}
          <PageHeader
            title="Your Haul"
            action={
              // Filled primary, not outline — matches Home's Scan button
              // exactly (same destination, same weight as the app's other
              // primary-nav Scan entry point). asChild renders the Link as
              // the element itself rather than a <button> inside an <a>.
              <Button asChild size="sm" className="h-11 rounded-control font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/scan">
                  <ScanLine className="w-4 h-4" aria-hidden="true" /> Scan
                </Link>
              </Button>
            }
          />

          <div className="px-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search your collection…"
                aria-label="Search your collection"
                className="h-11 pl-9 bg-secondary border-border font-body"
              />
            </div>
            {/* Only at exactly 1 character — the one moment the 2-char
                minimum (line 184) makes typing look like it's doing
                nothing. Once filtering actually starts, the active-filter
                chip row already covers this. */}
            {searchQuery.length === 1 && (
              <p className="text-2xs font-mono text-muted-foreground mt-1.5 ml-1">
                Type one more character to search
              </p>
            )}
          </div>

          {/* Inside the gradient zone with the header and search, so the fade
              matches Home's hero zone. */}
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={filtered.length}
            onClearFilters={clearSheetFilters}
          />
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="px-5 flex flex-wrap items-center gap-2">
          {activeFilterChips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-2xs font-mono"
            >
              {chip.label}
              {/* p-4/-m-4 expands the invisible tap target to a full 44px
                  without growing the pill itself — was p-1.5/-m-1 (~24px
                  effective), the smallest interactive element on this page. */}
              <button
                onClick={chip.onRemove}
                aria-label={`Remove ${chip.label} filter`}
                className="p-4 -m-4 rounded-full hover:bg-primary/20 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="h-11 px-2 text-2xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Count line: what you're looking at, plus the two collection-wide
          actions that used to crowd the header. */}
      {!isLoading && !hasLoadError && (
        <div className="px-5 -my-1 flex items-center justify-between gap-2">
          <p className="text-xs font-mono text-muted-foreground min-w-0 truncate" aria-live="polite">
            {selectionMode
              ? `${selectedIds.size} selected`
              : hasActiveFilters
                ? `${filtered.length} of ${collection.length} cans`
                : `${collection.length} can${collection.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center flex-shrink-0">
            {collection.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={toggleSelectionMode}
                aria-pressed={selectionMode}
                className={cn('h-11 px-3 gap-1.5 font-mono text-xs', selectionMode ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                {selectionMode ? <X className="w-4 h-4" aria-hidden="true" /> : <CheckSquare className="w-4 h-4" aria-hidden="true" />}
                {selectionMode ? 'Done' : 'Select'}
              </Button>
            )}
            <Button asChild variant="ghost" className="h-11 px-3 gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground">
              <Link to="/crates">
                <PackageOpen className="w-4 h-4" aria-hidden="true" /> Crates
              </Link>
            </Button>
          </div>
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
                    selectable={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={() => toggleSelected(item.id)}
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
                    selectable={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={() => toggleSelected(item.id)}
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

      {/* Bulk action bar — sticky to the bottom of <main>'s own scroll
          container (AppLayout.jsx), not position:fixed against the
          viewport: BottomNav isn't fixed either, it's a normal-flow flex
          sibling below <main>, so a fixed bar would need a guessed pixel
          offset to sit above it instead of overlapping it. Sticky needs no
          such guess — it naturally stops at <main>'s own bottom edge, right
          above BottomNav, at any BottomNav height. Only the two actions the
          audit specifically called out (favourite, add to crate) — bulk
          status/delete weren't asked for and would need their own
          confirm-before-destructive treatment. */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="sticky bottom-0 z-30 pt-3 pb-3 px-5 bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl shadow-lg p-2 flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => bulkFavouriteMutation.mutate(selectedItems)}
              disabled={bulkFavouriteMutation.isPending}
            >
              <Star className="w-4 h-4" /> Favourite
            </Button>
            <Button
              className="flex-1 h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setBulkCrateTargets(selectedItems)}
            >
              <PackagePlus className="w-4 h-4" /> Add to Crate
            </Button>
          </div>
        </div>
      )}

      {crateTarget && (
        <AddToCrateSheet can={crateTarget} onClose={() => setCrateTarget(null)} />
      )}
      {bulkCrateTargets && (
        <AddToCrateSheet
          cans={bulkCrateTargets}
          onClose={() => setBulkCrateTargets(null)}
        />
      )}
    </div>
  );
}
