import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { AlertCircle, ArrowRightLeft, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { RARITY_TEXT_CLASS } from '@/lib/rarityConsensus';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';

const STATUS_STYLES = {
  pending:   { label: 'Pending',   class: 'bg-warning/10 text-warning border-warning/20' },
  completed: { label: 'Completed', class: 'bg-success/10 text-success border-success/20' },
  cancelled: { label: 'Cancelled', class: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const FILTER_OPTIONS = ['all', 'pending', 'completed', 'cancelled'];

export default function TradeHistory({ userId, user, onLogTrade }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [tradeToDelete, setTradeToDelete] = useState(null);

  const {
    data: trades = [],
    isLoading,
    isError,
    refetch: refetchTrades,
  } = useQuery({
    queryKey: ['trades', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (isError) toast.error('Could not load your trade history');
  }, [isError]);

  const deleteTrade = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('trades').delete().eq('id', id).eq('owner_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      toast.success('Trade removed');
      setTradeToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to remove trade: ' + (error.message || 'Unknown error'));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase
        .from('trades')
        .update({ status })
        .eq('id', id)
        .eq('owner_id', userId);
      if (error) throw error;
      // TODO: notify trade partner via RPC (deferred)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      toast.success('Trade status updated');
    },
    onError: (error) => {
      toast.error('Failed to update trade status: ' + (error.message || 'Unknown error'));
    },
  });

  const filtered = filter === 'all' ? trades : trades.filter(t => (t.status || 'pending') === filter);

  return (
    <div className="px-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground tracking-wide">Trade History</h2>
          {trades.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground">({trades.length})</span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-11 font-mono text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10" onClick={onLogTrade}>
          <Plus className="w-3.5 h-3.5" /> Log Trade
        </Button>
      </div>

      {/* Filter toggles */}
      {trades.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              aria-pressed={filter === opt}
              className={cn(
                'h-9 px-2.5 flex items-center rounded-lg border text-[11px] font-mono transition-colors capitalize',
                filter === opt
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {opt === 'all' ? 'All' : STATUS_STYLES[opt].label}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="bg-card border border-destructive/30 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm font-mono text-muted-foreground">Couldn't load your trade history.</p>
          <Button
            variant="outline"
            size="sm"
            className="h-11 mt-3 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => refetchTrades()}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && trades.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <ArrowRightLeft className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm font-mono text-muted-foreground">No trades logged yet.</p>
          <Button size="sm" variant="ghost" className="h-11 mt-2 font-mono text-xs text-primary" onClick={onLogTrade}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Log your first trade
          </Button>
        </div>
      )}

      {!isLoading && !isError && trades.length > 0 && filtered.length === 0 && (
        <p className="text-xs font-mono text-muted-foreground text-center py-4">No {filter} trades.</p>
      )}

      {!isLoading && filtered.map(trade => (
        <TradeCard
          key={trade.id}
          trade={trade}
          onDelete={() => setTradeToDelete(trade)}
          onStatusChange={(status) => updateStatus.mutate({ id: trade.id, status })}
        />
      ))}

      <ConfirmDialog
        open={!!tradeToDelete}
        onCancel={() => setTradeToDelete(null)}
        onConfirm={() => deleteTrade.mutate(tradeToDelete.id)}
        isPending={deleteTrade.isPending}
        title="Remove Trade?"
        description="This trade record will be permanently removed from your history. This cannot be undone."
      />
    </div>
  );
}

function TradeCard({ trade, onDelete, onStatusChange }) {
  const status = trade.status || 'pending';
  const style = STATUS_STYLES[status];

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 space-y-2.5">
      {/* Cans row */}
      <div className="flex items-center gap-2">
        <CanChip name={trade.traded_away_name} brand={trade.traded_away_brand} imageUrl={trade.traded_away_image_url} rarity={trade.traded_away_rarity} label="Gave" />
        <ArrowRightLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <CanChip name={trade.received_name} brand={trade.received_brand} imageUrl={trade.received_image_url} rarity={trade.received_rarity} label="Got" />
      </div>

      {/* Status + meta row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Status badge — click to cycle */}
          <div className="flex gap-1">
            {['pending', 'completed', 'cancelled'].map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                aria-label={`Set status to ${STATUS_STYLES[s].label}`}
                aria-pressed={status === s}
                className={cn(
                  'h-9 px-2 flex items-center rounded-md border text-[10px] font-mono transition-colors capitalize',
                  status === s
                    ? STATUS_STYLES[s].class
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {STATUS_STYLES[s].label}
              </button>
            ))}
          </div>
          {trade.traded_with && (
            <span className="text-[11px] font-mono text-muted-foreground truncate">with {trade.traded_with}</span>
          )}
          {trade.trade_date && (
            <span className="text-[11px] font-mono text-muted-foreground">
              · {format(new Date(trade.trade_date), 'MMM d, yyyy')}
            </span>
          )}
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete trade"
          className="w-11 h-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {trade.notes && (
        <p className="text-[11px] font-mono text-muted-foreground italic">{trade.notes}</p>
      )}
    </div>
  );
}

function CanChip({ name, brand, imageUrl, rarity, label }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-mono text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-secondary rounded-lg px-2 py-1.5">
        <div className="w-7 h-7 rounded-md overflow-hidden border border-border flex-shrink-0" style={{ background: DEFAULT_CAN_BG }}>
          {imageUrl && <img src={imageUrl} alt={name} loading="lazy" decoding="async" className="w-full h-full object-contain" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-body font-medium text-foreground truncate leading-tight">{name}</p>
          {rarity && (
            <p className={`text-[10px] font-mono leading-tight ${RARITY_TEXT_CLASS[rarity] || 'text-muted-foreground'}`}>{rarity}</p>
          )}
        </div>
      </div>
    </div>
  );
}
