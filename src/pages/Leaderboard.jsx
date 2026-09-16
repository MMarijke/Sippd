import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Star, Search, MapPin, X, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import CollectorsLeaderboard from '@/components/leaderboard/CollectorsLeaderboard';
import MostWanted from './MostWanted';
import RegionalLeaderboard from '@/components/leaderboard/RegionalLeaderboard';
import FindCollectors from '@/components/leaderboard/FindCollectors';
import FeedContent from '@/components/feed/FeedContent';

export default function Leaderboard() {
  const [tab, setTab] = useState('collectors');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-0">
      <PageHeader title="Ranks" subtitle={
        tab === 'collectors' ? 'Global Collector Leaderboard' :
        tab === 'regional' ? 'Regional Leaderboard' :
        tab === 'feed' ? 'Community Activity' :
        'Community Most Wanted'
      } />

      {/* Tab toggle — rendered above the search bar so the search dropdown
          (which floats below the search input) never has to compete with
          primary navigation for stacking order. It used to sit below the
          search bar with the dropdown positioned on top of it: any open
          result set fully occluded the tab row and blocked pointer events
          to it, so switching tabs required first clearing the search text
          (/impeccable critique). Now the dropdown only ever overlays the
          scrollable list content beneath it, which is the same benign
          overlay pattern TradeLogDialog.jsx's own search already uses. */}
      <div className="px-5 pb-4">
        {/* min-w-0 on each flex-1 Button lets it actually shrink below its
            whitespace-nowrap content width instead of overflowing the
            tablist — at 390px "Regional" previously spilled ~25px past the
            container's right edge (/impeccable critique). The label itself
            truncates rather than the Button, so the fixed-size icon next to
            it never gets squeezed. */}
        {/* Segmented filter, not a tab set — standardized on aria-pressed
            (see Feed.jsx/CompareCollection.jsx for the same change and
            reasoning: role="tab"/tablist implies arrow-key navigation none
            of these ever implemented). */}
        <div aria-label="Leaderboard view" className="flex bg-secondary rounded-lg border border-border p-0.5">
          <Button
            variant="ghost"
            aria-pressed={tab === 'collectors'}
            className={cn('flex-1 min-w-0 h-11 font-mono text-xs gap-1.5', tab === 'collectors' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setTab('collectors')}
          >
            <Trophy className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Collectors</span>
          </Button>
          <Button
            variant="ghost"
            aria-pressed={tab === 'mostwanted'}
            className={cn('flex-1 min-w-0 h-11 font-mono text-xs gap-1.5', tab === 'mostwanted' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setTab('mostwanted')}
          >
            <Star className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Most Wanted</span>
          </Button>
          <Button
            variant="ghost"
            aria-pressed={tab === 'regional'}
            className={cn('flex-1 min-w-0 h-11 font-mono text-xs gap-1.5', tab === 'regional' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setTab('regional')}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Regional</span>
          </Button>
          {/* Feed merged in here (/impeccable critique: bottom nav was
              crowded at 6 items) — same segmented-tab pattern as the three
              tabs above it, not a new interaction to learn. */}
          <Button
            variant="ghost"
            aria-pressed={tab === 'feed'}
            className={cn('flex-1 min-w-0 h-11 font-mono text-xs gap-1.5', tab === 'feed' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setTab('feed')}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Feed</span>
          </Button>
        </div>
      </div>

      {/* Find Collectors search — the dropdown is a floating overlay
          (matching TradeLogDialog.jsx's own trade-partner search: same
          absolute top-full/z-10/shadow-lg convention), not in normal
          document flow. It used to push the tab toggle and whatever tab
          was active downward while typing (/impeccable critique) —
          exactly the moment a one-handed mobile user least wants the
          layout moving under their thumb. */}
      <div className="px-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Find Collectors by name..."
            className="h-11 pl-9 pr-11 bg-secondary border-border font-body"
          />
          {/* The only way to dismiss a search used to be manually deleting
              every typed character — no visible affordance for it, and
              (before the dropdown-occlusion fix) it was also the only way
              to make the tab toggle clickable again while typing
              (/impeccable critique). */}
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-10 max-h-80 overflow-y-auto shadow-lg">
              <FindCollectors query={searchQuery} tab={tab} />
            </div>
          )}
        </div>
      </div>

      {tab === 'collectors' ? <CollectorsLeaderboard />
        : tab === 'regional' ? <RegionalLeaderboard />
        : tab === 'feed' ? <FeedContent />
        : <MostWanted />}
    </div>
  );
}