import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import CollectorsLeaderboard from '@/components/leaderboard/CollectorsLeaderboard';
import MostWanted from './MostWanted';
import RegionalLeaderboard from '@/components/leaderboard/RegionalLeaderboard';
import FindCollectors from '@/components/leaderboard/FindCollectors';
import FeedContent from '@/components/feed/FeedContent';

// Text-only and sized to their labels: with icons and equal widths, every
// label truncated to two letters at 375px ("Co…", "Mo…"), since each got 28px
// of the 72px "Collectors" needs (/impeccable critique). "Wanted" keeps the
// four within 280px at 320.
const TABS = [
  { value: 'collectors', label: 'Collectors' },
  { value: 'mostwanted', label: 'Wanted' },
  { value: 'regional',   label: 'Regional' },
  { value: 'feed',       label: 'Feed' },
];
const TAB_VALUES = TABS.map(t => t.value);

export default function Leaderboard() {
  // The tab lives in the URL (?tab=) rather than local state, so a reload or
  // shared link keeps it and a link to another tab works even when Ranks is
  // already mounted (Feed's "Find Collectors" used to go nowhere).
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TAB_VALUES.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'collectors';
  // A tab's own view params (?sort=, ?drink=, ?jump=) don't carry across.
  const setTab = value => setSearchParams({ tab: value }, { replace: true });

  // Search is page-wide (it finds people from any tab), so it opens from the
  // header rather than sitting between the tabs and a tab's own controls,
  // where it read as tab-scoped and cost 56px on every visit.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchButtonRef = useRef(null);

  // ?find=1 (Feed's empty-state button) opens the search straight away.
  useEffect(() => {
    if (searchParams.get('find') !== '1') return;
    setSearchOpen(true);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('find');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };

  return (
    <div className="space-y-0">
      <PageHeader
        title="Ranks"
        action={
          <button
            ref={searchButtonRef}
            type="button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            aria-label={searchOpen ? 'Close collector search' : 'Find collectors'}
            aria-expanded={searchOpen}
            className={cn('h-11 w-11 rounded-md border flex items-center justify-center transition-colors',
              searchOpen ? 'bg-card border-primary/50 text-foreground' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
        }
      />

      {searchOpen && (
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') closeSearch(); }}
              aria-label="Find collectors by name"
              placeholder="Find collectors by name"
              className="h-11 pl-9 pr-11 bg-secondary border-border font-body [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            {/* Floating overlay, not in flow, so typing never shifts the
                tabs or list under your thumb. */}
            {searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-20 max-h-80 overflow-y-auto shadow-lg">
                <FindCollectors query={searchQuery} tab={tab} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Underlined page navigation, so it no longer wears the same filled
          segmented skin as the filters below it: five identical bars made
          every control look equally important (/impeccable critique). */}
      <div role="group" aria-label="Ranks view" className="mx-5 mb-4 flex justify-between gap-2 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.value}
            type="button"
            aria-pressed={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn('relative h-11 px-1.5 font-mono text-xs whitespace-nowrap transition-colors',
              tab === t.value ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            <span
              aria-hidden="true"
              className={cn('absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors', tab === t.value ? 'bg-primary' : 'bg-transparent')}
            />
          </button>
        ))}
      </div>

      {tab === 'collectors' ? <CollectorsLeaderboard />
        : tab === 'regional' ? <RegionalLeaderboard />
        : tab === 'feed' ? <FeedContent />
        : <MostWanted />}
    </div>
  );
}
