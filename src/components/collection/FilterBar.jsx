import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutGrid, List, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function FilterBar({ filters, onFiltersChange, viewMode, onViewModeChange }) {
  const update = (key, value) => onFiltersChange({ ...filters, [key]: value });

  return (
    <div className="px-5 space-y-2">
      <div className="flex items-center gap-2">
        <Select value={filters.status} onValueChange={v => update('status', v)}>
          <SelectTrigger aria-label="Filter by status" className="flex-1 bg-secondary border-border text-xs font-mono h-11">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="collected">In Vault</SelectItem>
            <SelectItem value="wishlist">Wishlist</SelectItem>
            <SelectItem value="duplicate">Duplicates</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.rarity} onValueChange={v => update('rarity', v)}>
          <SelectTrigger aria-label="Filter by rarity" className="flex-1 bg-secondary border-border text-xs font-mono h-11">
            <SelectValue placeholder="Rarity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rarity</SelectItem>
            <SelectItem value="Common">Common</SelectItem>
            <SelectItem value="Uncommon">Uncommon</SelectItem>
            <SelectItem value="Rare">Rare</SelectItem>
            <SelectItem value="Ultra Rare">Ultra Rare</SelectItem>
            <SelectItem value="Legendary">Legendary</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex bg-secondary rounded-lg border border-border p-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            className={`h-11 w-11 ${viewMode === 'grid' ? 'bg-card text-primary' : 'text-muted-foreground'}`}
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            className={`h-11 w-11 ${viewMode === 'list' ? 'bg-card text-primary' : 'text-muted-foreground'}`}
            onClick={() => onViewModeChange('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Second row: favourites + sort */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => update('favourites', !filters.favourites)}
          aria-pressed={filters.favourites}
          className={cn(
            'flex items-center gap-1.5 h-11 px-3 rounded-lg border text-xs font-mono transition-colors',
            filters.favourites
              ? 'bg-primary/10 border-primary/40 text-primary'
              : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          )}
        >
          <Star className={cn('w-3.5 h-3.5', filters.favourites && 'fill-primary')} />
          Favourites
        </button>

        <Select value={filters.sort || 'date_desc'} onValueChange={v => update('sort', v)}>
          <SelectTrigger aria-label="Sort by" className="flex-1 bg-secondary border-border text-xs font-mono h-11">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest First</SelectItem>
            <SelectItem value="date_asc">Oldest First</SelectItem>
            <SelectItem value="brand_asc">Brand A–Z</SelectItem>
            <SelectItem value="brand_desc">Brand Z–A</SelectItem>
            <SelectItem value="rarity_desc">Rarity High–Low</SelectItem>
            <SelectItem value="rarity_asc">Rarity Low–High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}