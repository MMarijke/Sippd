import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { X, Plus, Minus, PackageOpen, AlertCircle, RefreshCw } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { tileBackground } from '@/lib/canBgColors';
import CrateFormDialog from '@/components/crates/CrateFormDialog';

export default function AddToCrateSheet({ can, cans, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isPro } = useSubscription();
  const queryClient = useQueryClient();
  const [showCreateCrate, setShowCreateCrate] = useState(false);

  // Bulk mode (multiple cans selected via Collection's selection mode) adds
  // every selected can to one chosen crate in a single tap, rather than the
  // per-crate add/remove toggle single-can mode uses below — "remove" has no
  // clear meaning across a mixed set where some cans may already be in a
  // given crate and others aren't.
  const isBulk = Array.isArray(cans) && cans.length > 0;
  const bulkIds = isBulk ? cans.map(c => c.id) : [];

  const { data: crates = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['crates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crates')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ crate, adding }) => {
      const newIds = adding
        ? [...(crate.can_ids || []), can.id]
        : (crate.can_ids || []).filter(id => id !== can.id);
      const { error } = await supabase.from('crates').update({ can_ids: newIds }).eq('id', crate.id);
      if (error) throw error;
    },
    onMutate: async ({ crate, adding }) => {
      await queryClient.cancelQueries({ queryKey: ['crates', user?.id] });
      const previous = queryClient.getQueryData(['crates', user?.id]);
      queryClient.setQueryData(['crates', user?.id], old =>
        (old || []).map(c => c.id === crate.id
          ? { ...c, can_ids: adding ? [...(c.can_ids || []), can.id] : (c.can_ids || []).filter(id => id !== can.id) }
          : c
        )
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['crates', user?.id], context.previous);
      toast.error('Failed to update crate: ' + (error.message || 'Unknown error'));
    },
    onSuccess: (_data, { crate, adding }) => {
      toast.success(adding ? `Added to ${crate.name}` : `Removed from ${crate.name}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['crates', user?.id] });
    },
  });

  const handleToggle = (crate, adding) => {
    if (adding && !isPro && (crate.can_ids || []).length >= 10) {
      toast.error('Free accounts are limited to 10 cans per crate — upgrade to Pro for unlimited');
      navigate('/pro');
      return;
    }
    toggleMutation.mutate({ crate, adding });
  };

  const bulkAddMutation = useMutation({
    mutationFn: async (crate) => {
      const existing = new Set(crate.can_ids || []);
      const toAdd = bulkIds.filter(id => !existing.has(id));
      const newIds = [...(crate.can_ids || []), ...toAdd];
      const { error } = await supabase.from('crates').update({ can_ids: newIds }).eq('id', crate.id);
      if (error) throw error;
      return toAdd.length;
    },
    onSuccess: (addedCount, crate) => {
      queryClient.invalidateQueries({ queryKey: ['crates', user?.id] });
      toast.success(
        addedCount > 0
          ? `Added ${addedCount} can${addedCount === 1 ? '' : 's'} to ${crate.name}`
          : `Already in ${crate.name}`
      );
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to update crate: ' + (error.message || 'Unknown error'));
    },
  });

  const handleBulkAdd = (crate) => {
    const existing = new Set(crate.can_ids || []);
    const newCount = bulkIds.filter(id => !existing.has(id)).length;
    if (newCount > 0 && !isPro && (crate.can_ids || []).length + newCount > 10) {
      toast.error('Free accounts are limited to 10 cans per crate — upgrade to Pro for unlimited');
      navigate('/pro');
      return;
    }
    bulkAddMutation.mutate(crate);
  };

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        hideClose
        className="max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl flex flex-col p-0"
        style={{ maxHeight: '85vh' }}
      >
        <SheetDescription className="sr-only">
          {isBulk ? `Add ${cans.length} selected cans to a crate.` : `Add "${can.can_name}" to one or more crates.`}
        </SheetDescription>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isBulk ? (
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <PackageOpen className="w-4 h-4 text-primary" />
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0"
                style={{ background: tileBackground(can.can_rarity, can.can_bg_color) }}
              >
                {can.can_image_url && (
                  <img src={can.can_image_url} alt={can.can_name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                )}
              </div>
            )}
            <div className="min-w-0">
              <SheetTitle asChild>
                <h2 className="text-base font-display font-bold text-foreground truncate">
                  {isBulk ? `${cans.length} cans selected` : can.can_name}
                </h2>
              </SheetTitle>
              <p className="text-2xs font-mono text-muted-foreground truncate">
                {isBulk ? 'Add all to a crate' : 'Add to crate'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
            </div>
          ) : isError ? (
            // Otherwise a failed fetch renders identically to "no crates
            // yet" (crates.length === 0 on error, same as on a genuinely
            // empty list) — same bug class already fixed on Collection.jsx's
            // own three queries, missed here.
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="w-12 h-12 text-destructive/40" />
              <p className="text-sm font-mono text-muted-foreground">Couldn't load your crates.</p>
              <Button
                size="sm"
                variant="outline"
                className="h-11 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          ) : crates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <PackageOpen className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm font-mono text-muted-foreground">No crates yet.</p>
              <Button
                size="sm"
                className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setShowCreateCrate(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Create Your First Crate
              </Button>
            </div>
          ) : (
            crates.map(crate => {
              if (isBulk) {
                const existing = new Set(crate.can_ids || []);
                const newCount = bulkIds.filter(id => !existing.has(id)).length;
                const allAlreadyIn = newCount === 0;
                return (
                  <div key={crate.id} className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl px-3 py-2.5">
                    <span className="text-xl flex-shrink-0">{crate.emoji || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-medium text-foreground truncate">{crate.name}</p>
                      <p className="text-2xs font-mono text-muted-foreground">
                        {(crate.can_ids || []).length} can{(crate.can_ids || []).length !== 1 ? 's' : ''}
                        {!allAlreadyIn && ` · ${newCount} new`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleBulkAdd(crate)}
                      disabled={bulkAddMutation.isPending || allAlreadyIn}
                      aria-label={allAlreadyIn ? `All selected cans already in ${crate.name}` : `Add ${newCount} cans to ${crate.name}`}
                      className={`h-11 px-3 rounded-lg flex items-center justify-center gap-1 border transition-colors flex-shrink-0 font-mono text-xs ${
                        allAlreadyIn
                          ? 'bg-secondary/40 border-border text-muted-foreground/50 pointer-events-none'
                          : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> {allAlreadyIn ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              }
              const inCrate = (crate.can_ids || []).includes(can.id);
              return (
                <div key={crate.id} className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl px-3 py-2.5">
                  <span className="text-xl flex-shrink-0">{crate.emoji || '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-medium text-foreground truncate">{crate.name}</p>
                    <p className="text-2xs font-mono text-muted-foreground">{(crate.can_ids || []).length} can{(crate.can_ids || []).length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(crate, !inCrate)}
                    disabled={toggleMutation.isPending}
                    aria-label={inCrate ? `Remove from ${crate.name}` : `Add to ${crate.name}`}
                    className={`w-11 h-11 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0 ${
                      inCrate
                        ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'
                        : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                    }`}
                  >
                    {inCrate ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>

      {showCreateCrate && (
        <CrateFormDialog onClose={() => setShowCreateCrate(false)} userId={user?.id} />
      )}
    </Sheet>
  );
}
