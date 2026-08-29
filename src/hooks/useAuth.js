import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export function useAuth() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setSession(session);
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
    // this device (shared/kiosk browser, or a fast sign-in swap).
    queryClient.clear();
    await supabase.auth.signOut();
  };

  return {
    user: session?.user ?? null,
    session,
    isLoading,
    signOut,
  };
}
