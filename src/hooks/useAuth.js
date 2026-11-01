import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { isNetworkAuthError, readStoredSession } from '@/lib/offline/session';
import { clearOfflineData } from '@/lib/offline/registry';

export function useAuth() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      // Offline with an expired access token, supabase-js returns no session
      // even though it's still stored: keep the user signed in on the stored
      // copy instead of bouncing them to Login (see lib/offline/session.js).
      const offlineSession = !session && isNetworkAuthError(error)
        ? readStoredSession(globalThis.localStorage, supabase.auth.storageKey)
        : null;
      setSession(session ?? offlineSession);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSession(session);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear before signing out, not after — stale query cache from the
    // previous session must never be visible to whoever logs in next on
    // this device (shared/kiosk browser, or a fast sign-in swap). The same
    // goes for the offline copy: this user's local database, queued writes
    // and cached Pro status leave the device too.
    queryClient.clear();
    await clearOfflineData(session?.user?.id);
    await supabase.auth.signOut();
  };

  return {
    user: session?.user ?? null,
    session,
    isLoading,
    signOut,
  };
}
