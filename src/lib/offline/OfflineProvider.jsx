import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getMeta, openUserDb } from './db';
import { createSupabaseRemote } from './remote';
import { createSyncEngine } from './sync';
import { startAutoSync } from './autoSync';
import { registerOffline } from './registry';
import { retryFailed as retryFailedEntries } from './outbox';
import { QUOTA_MESSAGE, isQuotaError, requestPersistentStorage } from './storage';

// Wires the local-first layer to the signed-in user: their own database,
// the sync engine and its triggers. Everything offline-capable reads
// `useOffline()`. Signed out, `db` is null and nothing syncs. See OFFLINE.md.
const OfflineContext = createContext(null);

const IDLE = { state: 'synced', pending: 0, failed: 0, lastSyncedAt: null, error: null };

export function OfflineProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [session, setSession] = useState(null); // { userId, db, engine, auto }
  const [status, setStatus] = useState(IDLE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    const db = openUserDb(userId);
    const engine = createSyncEngine({
      db,
      remote: createSupabaseRemote(supabase, userId),
      isOnline: () => navigator.onLine !== false,
      lockName: `sippd-sync-${userId}`,
    });
    let stopped = false;
    const unsubscribe = engine.subscribe((next) => {
      setStatus(next);
      if (next.lastSyncedAt) setHydrated(true);
    });
    // Hydrated already if this device has synced before (offline-capable now).
    getMeta(db, 'lastSyncedAt').then((at) => { if (!stopped && at) setHydrated(true); }).catch(() => {});
    const auto = startAutoSync(engine);
    requestPersistentStorage();
    setSession({ userId, db, engine, auto });

    const close = async () => {
      stopped = true;
      auto.stop();
      unsubscribe();
      db.close();
    };
    const unregister = registerOffline({ userId, close });
    return () => {
      unregister();
      close();
      setSession(null);
      setStatus(IDLE);
      setHydrated(false);
    };
  }, [userId]);

  const requestSync = useCallback(() => session?.auto.requestSync(), [session]);

  const retryFailed = useCallback(async () => {
    if (!session) return;
    await retryFailedEntries(session.db);
    session.engine.sync();
  }, [session]);

  // Runs an offline write; reports a full disk instead of failing silently.
  const write = useCallback(async (fn) => {
    if (!session) throw new Error('Not signed in');
    try {
      const result = await fn(session.db, userId);
      session.auto.requestSync();
      return result;
    } catch (error) {
      if (isQuotaError(error)) toast.error(QUOTA_MESSAGE);
      throw error;
    }
  }, [session, userId]);

  const value = useMemo(() => ({
    userId,
    db: session?.userId === userId ? session.db : null,
    status,
    hydrated,
    requestSync,
    retryFailed,
    write,
  }), [userId, session, status, hydrated, requestSync, retryFailed, write]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within an OfflineProvider');
  return ctx;
}
