import { useEffect, useState } from 'react';
import { AlertTriangle, CloudOff, Loader2, CloudUpload, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useOffline } from '@/lib/offline/OfflineProvider';
import { failedEntries } from '@/lib/offline/outbox';
import { useOnline } from '@/hooks/useOnline';
import { cn } from '@/lib/utils';

// The sync indicator, in the page header beside the bell. Quiet when all is
// well (a small check), words only when something needs attention:
// Offline · Syncing · N pending · Couldn't sync (with the reasons and a
// Retry). See OFFLINE.md.
function describe({ online, status }) {
  if (status.failed > 0) return { kind: 'error', label: "Couldn't sync", Icon: AlertTriangle };
  if (!online) return { kind: 'offline', label: status.pending ? `Offline · ${status.pending} to sync` : 'Offline', Icon: CloudOff };
  if (status.state === 'syncing') return { kind: 'syncing', label: 'Syncing', Icon: Loader2 };
  if (status.pending > 0) return { kind: 'pending', label: `${status.pending} to sync`, Icon: CloudUpload };
  return { kind: 'synced', label: 'Synced', Icon: Check };
}

export default function SyncStatus() {
  const { db, status, retryFailed } = useOffline();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [failures, setFailures] = useState([]);

  useEffect(() => {
    if (!open || !db) return;
    failedEntries(db).then(setFailures).catch(() => setFailures([]));
  }, [open, db, status.failed]);

  if (!db) return null;
  const { kind, label, Icon } = describe({ online, status });
  const quiet = kind === 'synced';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Sync status: ${label}`}
          className={cn(
            'h-11 flex items-center justify-center gap-1.5 rounded-control text-2xs font-mono transition-colors flex-shrink-0',
            quiet ? 'w-11 text-muted-foreground hover:text-foreground' : 'px-3 border border-border bg-secondary text-foreground',
            kind === 'error' && 'border-destructive/40 text-destructive',
          )}
        >
          <Icon className={cn('w-4 h-4', kind === 'syncing' && 'animate-spin')} aria-hidden="true" />
          {!quiet && <span>{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-sm space-y-3">
        {kind === 'error' ? (
          <>
            <p className="font-display font-semibold text-foreground">Some changes couldn't sync</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {failures.slice(0, 4).map((f) => (
                <li key={f.seq}>{f.lastError || 'Something went wrong.'}</li>
              ))}
            </ul>
            <Button size="sm" className="h-11 w-full font-mono text-xs" onClick={() => { retryFailed(); setOpen(false); }}>
              Retry
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {kind === 'offline' && "You're offline. Your collection, wishlist and profile still work here, and changes sync when you reconnect."}
            {kind === 'syncing' && 'Saving your changes to your account.'}
            {kind === 'pending' && 'Your latest changes are saved on this device and will sync in a moment.'}
            {kind === 'synced' && 'Everything on this device is saved to your account.'}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
