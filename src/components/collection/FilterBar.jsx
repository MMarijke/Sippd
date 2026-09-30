import { useId, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const BEVERAGE_TYPE_OPTIONS = [
  { value: 'all',          label: 'All drinks' },
  { value: 'energy_drink', label: 'Energy'     },
  { value: 'soft_drink',   label: 'Soft'       },
];

const STATUS_OPTIONS = [
  { value: 'all',       label: 'Any'        },
  { value: 'collected', label: 'In Vault'   },
  { value: 'wishlist',  label: 'Wishlist'   },
  { value: 'duplicate', label: 'Duplicates' },
];

// Each tier wears its own rarity colour, the app's signature ladder, so the
// rarity filter reads as the rarity system rather than a plain dropdown.
const RARITY_OPTIONS = [
  { value: 'all',        label: 'Any rarity', tone: 'border-border text-foreground',                                  on: 'bg-card border-foreground/40' },
  { value: 'Common',     label: 'Common',     tone: 'border-rarity-common/40 text-rarity-common-text',              on: 'bg-rarity-common/10 border-rarity-common' },
  { value: 'Uncommon',   label: 'Uncommon',   tone: 'border-rarity-uncommon/40 text-rarity-uncommon-text',          on: 'bg-rarity-uncommon/10 border-rarity-uncommon' },
  { value: 'Rare',       label: 'Rare',       tone: 'border-rarity-rare/40 text-rarity-rare-text',                  on: 'bg-rarity-rare/10 border-rarity-rare' },
  { value: 'Ultra Rare', label: 'Ultra Rare', tone: 'border-rarity-ultra/40 text-rarity-ultra-text',                on: 'bg-rarity-ultra/10 border-rarity-ultra' },
  { value: 'Legendary',  label: 'Legendary',  tone: 'border-rarity-legendary/40 text-rarity-legendary-text',        on: 'bg-rarity-legendary/10 border-rarity-legendary' },
];

// Choice pills sit on the sheet's background, never on bg-secondary: muted
// text on secondary is under 4.5:1 in 51 of 56 theme/polarity pairs (Sage
// 3.96, Power-Up 4.08), while muted on background passes in all of them.
const PILL_ON = 'bg-card border-foreground/40 text-foreground font-semibold';
const PILL_OFF = 'border-border text-muted-foreground hover:text-foreground';

// One word each, so Sort fits beside Filters and the view toggle at 320px.
const SORT_OPTIONS = [
  { value: 'date_desc',   label: 'Newest' },
  { value: 'date_asc',    label: 'Oldest' },
  { value: 'brand_asc',   label: 'Brand A–Z' },
  { value: 'brand_desc',  label: 'Brand Z–A' },
  { value: 'rarity_desc', label: 'Rarest' },
  { value: 'rarity_asc',  label: 'Least rare' },
];

// One row under the search: Filters (opens a sheet), Sort, and the view
// toggle. It replaces three stacked rows (drink type; status, rarity and
// grid/list; favourites and sort) that pushed the first can to y356 at
// 375px, and at 320px overflowed sideways by 38px because the two selects
// wouldn't shrink (/impeccable critique). Filters change the page live;
// the sheet's button just closes it, showing how many cans match.
export default function FilterBar({ filters, onFiltersChange, viewMode, onViewModeChange, resultCount, onClearFilters }) {
  const [open, setOpen] = useState(false);
  const favId = useId();
  const update = (key, value) => onFiltersChange({ ...filters, [key]: value });

  const activeCount = [
    filters.beverageType !== 'all',
    filters.status !== 'all',
    filters.rarity !== 'all',
    filters.favourites,
  ].filter(Boolean).length;

  return (
    <div className="px-5 flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
        className={cn('h-11 px-3 gap-1.5 font-mono text-xs flex-shrink-0',
          activeCount ? 'border-primary/50 bg-primary/10 text-foreground' : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
        )}
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-2xs font-bold flex items-center justify-center" aria-hidden="true">
            {activeCount}
          </span>
        )}
      </Button>

      <Select value={filters.sort || 'date_desc'} onValueChange={v => update('sort', v)}>
        <SelectTrigger aria-label="Sort by" className="flex-1 min-w-0 bg-transparent border-border text-foreground text-xs font-mono h-11">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* One toggle showing the view you'd switch to; a two-button group
          cost 48px more and was what overflowed at 320px. */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onViewModeChange(viewMode === 'list' ? 'grid' : 'list')}
        aria-label="List view"
        aria-pressed={viewMode === 'list'}
        title={viewMode === 'list' ? 'Show as grid' : 'Show as list'}
        className="h-11 w-11 flex-shrink-0 bg-transparent border-border text-muted-foreground hover:text-foreground"
      >
        {viewMode === 'list' ? <LayoutGrid className="w-4 h-4" aria-hidden="true" /> : <List className="w-4 h-4" aria-hidden="true" />}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto p-5 pb-6 max-h-[85dvh] overflow-y-auto">
          <SheetTitle className="text-base font-display font-bold text-foreground pr-12">Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow down the cans shown in your haul.</SheetDescription>

          <Group label="Drink">
            <div className="flex flex-wrap gap-2">
              {BEVERAGE_TYPE_OPTIONS.map(opt => (
                <Choice
                  key={opt.value}
                  checked={filters.beverageType === opt.value}
                  onSelect={() => update('beverageType', opt.value)}
                  className={cn('px-3 rounded-full border', filters.beverageType === opt.value ? PILL_ON : PILL_OFF)}
                >
                  {opt.label}
                </Choice>
              ))}
            </div>
          </Group>

          <Group label="Status">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <Choice
                  key={opt.value}
                  checked={filters.status === opt.value}
                  onSelect={() => update('status', opt.value)}
                  className={cn('px-3 rounded-full border', filters.status === opt.value ? PILL_ON : PILL_OFF)}
                >
                  {opt.label}
                </Choice>
              ))}
            </div>
          </Group>

          <Group label="Rarity">
            <div className="flex flex-wrap gap-2">
              {RARITY_OPTIONS.map(opt => (
                <Choice
                  key={opt.value}
                  checked={filters.rarity === opt.value}
                  onSelect={() => update('rarity', opt.value)}
                  className={cn('px-3 rounded-full border uppercase tracking-wider', opt.tone, filters.rarity === opt.value && cn(opt.on, 'font-semibold'))}
                >
                  {opt.label}
                </Choice>
              ))}
            </div>
          </Group>

          <label htmlFor={favId} className="mt-5 min-h-12 flex items-center justify-between gap-3 border-t border-border pt-3 cursor-pointer">
            <span className="text-sm text-foreground">Favourites only</span>
            <Switch id={favId} checked={filters.favourites} onCheckedChange={v => update('favourites', v)} />
          </label>

          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClearFilters}
              disabled={activeCount === 0}
              className="h-11 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 h-11 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {resultCount === 0 ? 'No cans match' : `Show ${resultCount} can${resultCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Group({ label, children }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className="mt-5">
      <p id={id} className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}

function Choice({ checked, onSelect, className, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn('h-11 font-mono text-xs transition-colors', className)}
    >
      {children}
    </button>
  );
}
