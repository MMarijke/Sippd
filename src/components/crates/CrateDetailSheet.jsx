import { useState, useMemo } from 'react';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { X, Plus, Minus } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RARITY_ORDER } from '@/lib/rarityConsensus';
import { useSubscription } from '@/hooks/useSubscription';
import ProGate from '@/components/shared/ProGate';

const FREE_CRATE_CAN_LIMIT = 10;

export default function CrateDetailSheet({ crate, collection, onClose, onCrateUpdated }) {
  const queryClient = useQueryClient();
  const { isPro } = useSubscription();
  const [tab, setTab] = useState('contents'); // 'contents' | 'add'
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [canIds, setCanIds] = useState(crate.can_ids || []);

  const crateCanIds = useMemo(() => new Set(canIds), [canIds]);
  const atCanLimit = canIds.length >= FREE_CRATE_CAN_LIMIT && !isPro;

  const applySorting = (items) => items.slice().sort((a, b) => {
    if (sort === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
    if (sort === 'brand_asc') return (a.can_brand || '').localeCompare(b.can_brand || '');
    if (sort === 'brand_desc') return (b.can_brand || '').localeCompare(a.can_brand || '');
    if (sort === 'rarity_desc') return RARITY_ORDER.indexOf(b.can_rarity || 'Common') - RARITY_ORDER.indexOf(a.can_rarity || 'Common');
    if (sort === 'rarity_asc') return RARITY_ORDER.indexOf(a.can_rarity || 'Common') - RARITY_ORDER.indexOf(b.can_rarity || 'Common');
    return 0;
  });

  const contents = useMemo(
    () => applySorting(collection.filter(c => crateCanIds.has(c.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collection, crateCanIds, sort]
  );
  const available = useMemo(
    () => collection.filter(c => !crateCanIds.has(c.id) && c.status === 'collected'),
    [collection, crateCanIds]
  );
  const filteredAvailable = useMemo(
    () => available.filter(c =>
      !search || c.can_name?.toLowerCase().includes(search.toLowerCase()) || c.can_brand?.toLowerCase().includes(search.toLowerCase())
    ),
    [available, search]
  );

  const updateCrate = useMutation({
    mutationFn: async (newIds) => {
      const { error } = await supabase.from('crates').update({ can_ids: newIds }).eq('id', crate.id);
      if (error) throw error;
    },
    onMutate: async (newIds) => {
      const previousIds = canIds;
      setCanIds(newIds);
      return { previousIds };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crates'] });
      onCrateUpdated();
    },
    onError: (error, _newIds, context) => {
      if (context?.previousIds) setCanIds(context.previousIds);
      toast.error('Failed to update crate: ' + (error.message || 'Unknown error'));
    },
  });

  const addCan = (canId) => {
    updateCrate.mutate([...canIds, canId], {
      onSuccess: () => toast.success('Added to crate'),
    });
  };

  const removeCan = (canId) => {
    updateCrate.mutate(canIds.filter(id => id !== canId), {
      onSuccess: () => toast.success('Removed from crate'),
    });
  };

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        hideClose
        className="max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl flex flex-col p-0"
        style={{ maxHeight: '85vh' }}
      >
        <SheetDescription className="sr-only">Manage which cans are in the "{crate.name}" crate.</SheetDescription>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{crate.emoji || '📦'}</span>
            <div>
              <SheetTitle asChild>
                <h2 className="text-base font-display font-bold text-foreground">{crate.name}</h2>
              </SheetTitle>
              {crate.description && <p className="text-[11px] font-mono text-muted-foreground">{crate.description}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Crate view" className="flex px-5 pb-2 gap-2 flex-shrink-0">
          <button
            role="tab"
            aria-selected={tab === 'contents'}
            onClick={() => setTab('contents')}
            className={`flex-1 h-8 rounded-lg font-mono text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === 'contents' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            In Crate ({contents.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === 'add'}
            onClick={() => { setTab('add'); setSearch(''); }}
            className={`flex-1 h-8 rounded-lg font-mono text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === 'add' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            <Plus className="w-3 h-3 inline mr-1" />Add Cans
          </button>
        </div>

        {/* Sort row (contents tab only) */}
        {tab === 'contents' && contents.length > 0 && (
          <div className="px-5 pb-3 flex-shrink-0">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full bg-secondary border-border text-xs font-mono h-8">
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
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
          {tab === 'add' && (
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your collection…"
              className="bg-secondary border-border font-body mb-3"
            />
          )}

          {tab === 'add' && atCanLimit && (
            <ProGate reason="Upgrade to add more than 10 cans per crate">{null}</ProGate>
          )}

          {tab === 'contents' && contents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm font-mono text-muted-foreground">This crate is empty.</p>
              <Button size="sm" variant="ghost" className="mt-2 font-mono text-xs text-primary" onClick={() => setTab('add')}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add cans
              </Button>
            </div>
          )}

          {tab === 'contents' && contents.map(item => (
            <CanRow key={item.id} item={item} action="remove" onAction={() => removeCan(item.id)} />
          ))}

          {tab === 'add' && filteredAvailable.length === 0 && (
            <p className="text-center text-sm font-mono text-muted-foreground py-8">
              {available.length === 0 ? 'All collected cans are already in this crate.' : 'No cans match your search.'}
            </p>
          )}

          {tab === 'add' && filteredAvailable.map(item => (
            <CanRow key={item.id} item={item} action="add" onAction={() => addCan(item.id)} disabled={atCanLimit} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CanRow({ item, action, onAction, disabled }) {
  return (
    <div className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl px-3 py-2.5">
      <div
        className="w-9 h-9 rounded-lg overflow-hidden border border-border flex-shrink-0"
        style={{ background: item.can_bg_color || DEFAULT_CAN_BG }}
      >
        {item.can_image_url && (
          <img src={item.can_image_url} alt={item.can_name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-body font-medium text-foreground truncate">{item.can_name}</p>
        <p className="text-[11px] font-mono text-muted-foreground">{item.can_brand}</p>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        className={`w-11 h-11 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0 ${
          action === 'add'
            ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
            : 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'
        } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        {action === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
