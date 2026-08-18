import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RARITY_ORDER } from '@/lib/rarityConsensus';

export default function CrateDetailSheet({ crate, collection, onClose, onCrateUpdated }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('contents'); // 'contents' | 'add'
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date_desc');

  const crateCanIds = new Set(crate.can_ids || []);

  const applySorting = (items) => items.slice().sort((a, b) => {
    if (sort === 'date_asc') return new Date(a.created_date) - new Date(b.created_date);
    if (sort === 'date_desc') return new Date(b.created_date) - new Date(a.created_date);
    if (sort === 'brand_asc') return (a.can_brand || '').localeCompare(b.can_brand || '');
    if (sort === 'brand_desc') return (b.can_brand || '').localeCompare(a.can_brand || '');
    if (sort === 'rarity_desc') return RARITY_ORDER.indexOf(b.can_rarity || 'Common') - RARITY_ORDER.indexOf(a.can_rarity || 'Common');
    if (sort === 'rarity_asc') return RARITY_ORDER.indexOf(a.can_rarity || 'Common') - RARITY_ORDER.indexOf(b.can_rarity || 'Common');
    return 0;
  });

  const contents = applySorting(collection.filter(c => crateCanIds.has(c.id)));
  const available = collection.filter(c => !crateCanIds.has(c.id) && c.status === 'collected');
  const filteredAvailable = available.filter(c =>
    !search || c.can_name?.toLowerCase().includes(search.toLowerCase()) || c.can_brand?.toLowerCase().includes(search.toLowerCase())
  );

  const updateCrate = useMutation({
    mutationFn: (newIds) => base44.entities.Crate.update(crate.id, { can_ids: newIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crates'] });
      onCrateUpdated();
    },
  });

  const addCan = (canId) => {
    const newIds = [...(crate.can_ids || []), canId];
    crate.can_ids = newIds; // optimistic local update
    updateCrate.mutate(newIds);
    toast.success('Added to crate');
  };

  const removeCan = (canId) => {
    const newIds = (crate.can_ids || []).filter(id => id !== canId);
    crate.can_ids = newIds;
    updateCrate.mutate(newIds);
    toast.success('Removed from crate');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{crate.emoji || '📦'}</span>
            <div>
              <h2 className="text-base font-display font-bold text-foreground">{crate.name}</h2>
              {crate.description && <p className="text-[11px] font-mono text-muted-foreground">{crate.description}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pb-2 gap-2 flex-shrink-0">
          <button
            onClick={() => setTab('contents')}
            className={`flex-1 h-8 rounded-lg font-mono text-xs border transition-colors ${tab === 'contents' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            In Crate ({contents.length})
          </button>
          <button
            onClick={() => { setTab('add'); setSearch(''); }}
            className={`flex-1 h-8 rounded-lg font-mono text-xs border transition-colors ${tab === 'add' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
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
              placeholder="Search your collection..."
              className="bg-secondary border-border font-body mb-3"
            />
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
            <CanRow key={item.id} item={item} action="add" onAction={() => addCan(item.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CanRow({ item, action, onAction }) {
  return (
    <div className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl px-3 py-2.5">
      <div
        className="w-9 h-9 rounded-lg overflow-hidden border border-border flex-shrink-0"
        style={{ background: item.can_bg_color || '#0D2B2B' }}
      >
        {item.can_image_url && (
          <img src={item.can_image_url} alt={item.can_name} className="w-full h-full object-contain" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-body font-medium text-foreground truncate">{item.can_name}</p>
        <p className="text-[11px] font-mono text-muted-foreground">{item.can_brand}</p>
      </div>
      <button
        onClick={onAction}
        className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0 ${
          action === 'add'
            ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
            : 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'
        }`}
      >
        {action === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}