import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Star, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import CollectorsLeaderboard from '@/components/leaderboard/CollectorsLeaderboard';
import MostWanted from './MostWanted';
import RegionalLeaderboard from '@/components/leaderboard/RegionalLeaderboard';
import FindCollectors from '@/components/leaderboard/FindCollectors';

export default function Leaderboard() {
  const [tab, setTab] = useState('collectors');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-0">
      <PageHeader title="Ranks" subtitle={
        tab === 'collectors' ? 'Global Collector Leaderboard' :
        tab === 'regional' ? 'Regional Leaderboard' :
        'Community Most Wanted'
      } />

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
            className="h-11 pl-9 bg-secondary border-border font-body"
          />
          {searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-10 max-h-80 overflow-y-auto shadow-lg">
              <FindCollectors query={searchQuery} tab={tab} />
            </div>
          )}
        </div>
      </div>

      {/* Tab toggle */}
      <div className="px-5 pb-4">
        <div role="tablist" aria-label="Leaderboard view" className="flex bg-secondary rounded-lg border border-border p-0.5">
          <Button
            variant="ghost"
            role="tab"
            aria-selected={tab === 'collectors'}
            className={cn('flex-1 h-11 font-mono text-xs gap-1.5', tab === 'collectors' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setTab('collectors')}
          >
            <Trophy className="w-3.5 h-3.5" /> Collectors
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={tab === 'mostwanted'}
            className={cn('flex-1 h-11 font-mono text-xs gap-1.5', tab === 'mostwanted' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setTab('mostwanted')}
          >
            <Star className="w-3.5 h-3.5" /> Most Wanted
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={tab === 'regional'}
            className={cn('flex-1 h-11 font-mono text-xs gap-1.5', tab === 'regional' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setTab('regional')}
          >
            <MapPin className="w-3.5 h-3.5" /> Regional
          </Button>
        </div>
      </div>

      {tab === 'collectors' ? <CollectorsLeaderboard /> : tab === 'regional' ? <RegionalLeaderboard /> : <MostWanted />}
    </div>
  );
}