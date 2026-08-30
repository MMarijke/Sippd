import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { X, BookmarkCheck, Trash2, ArrowRightLeft, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { RARITY_TEXT_CLASS } from '@/lib/rarityConsensus';

export default function TradeTemplatesSheet({ onClose, onUseTemplate }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['trade-templates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_templates')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('trade_templates').delete().eq('id', id).eq('owner_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-templates'] });
      toast.success('Template deleted');
      setTemplateToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to delete template: ' + (error.message || 'Unknown error'));
    },
  });

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        hideClose
        className="max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl flex flex-col p-0"
        style={{ maxHeight: '80vh' }}
      >
        <SheetDescription className="sr-only">Reuse a saved trade template to prefill a new trade.</SheetDescription>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-4 h-4 text-primary" />
            <SheetTitle asChild>
              <h2 className="text-base font-display font-bold text-foreground">Trade Templates</h2>
            </SheetTitle>
            {templates.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground">({templates.length})</span>
            )}
          </div>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}
            </div>
          )}

          {!isLoading && templates.length === 0 && (
            <div className="text-center py-10">
              <BookmarkCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm font-mono text-muted-foreground">No templates saved yet.</p>
              <p className="text-xs font-mono text-muted-foreground mt-1">Save a template while logging a trade.</p>
            </div>
          )}

          {!isLoading && templates.map(tpl => (
            <div key={tpl.id} className="bg-secondary border border-border rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-display font-semibold text-foreground truncate">{tpl.name}</p>
                <button
                  onClick={() => setTemplateToDelete(tpl)}
                  aria-label="Delete template"
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Can preview */}
              <div className="flex items-center gap-2">
                <CanChip name={tpl.traded_away_name} brand={tpl.traded_away_brand} imageUrl={tpl.traded_away_image_url} rarity={tpl.traded_away_rarity} label="Give" />
                <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <CanChip name={tpl.received_name} brand={tpl.received_brand} imageUrl={tpl.received_image_url} rarity={tpl.received_rarity} label="Get" />
              </div>

              {tpl.notes && (
                <p className="text-[11px] font-mono text-muted-foreground italic truncate">{tpl.notes}</p>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 font-mono text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                onClick={() => { onUseTemplate(tpl); onClose(); }}
              >
                <Plus className="w-3 h-3" /> Use Template
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>

      <ConfirmDialog
        open={!!templateToDelete}
        onCancel={() => setTemplateToDelete(null)}
        onConfirm={() => deleteTemplate.mutate(templateToDelete.id)}
        isPending={deleteTemplate.isPending}
        title="Delete Template?"
        description={
          <>
            <span className="text-foreground font-semibold">{templateToDelete?.name}</span> will be deleted. This cannot be undone.
          </>
        }
      />
    </Sheet>
  );
}

function CanChip({ name, brand, imageUrl, rarity, label }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-mono text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-card rounded-lg px-2 py-1.5">
        <div className="w-7 h-7 rounded-md overflow-hidden border border-border flex-shrink-0 bg-[#0D2B2B]">
          {imageUrl && <img src={imageUrl} alt={name} loading="lazy" decoding="async" className="w-full h-full object-contain" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-body font-medium text-foreground truncate leading-tight">{name || '—'}</p>
          {rarity && (
            <p className={`text-[10px] font-mono leading-tight ${RARITY_TEXT_CLASS[rarity] || 'text-muted-foreground'}`}>{rarity}</p>
          )}
        </div>
      </div>
    </div>
  );
}
