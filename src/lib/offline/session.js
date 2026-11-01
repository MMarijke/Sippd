// Keeping the user signed in while offline.
//
// supabase-js (auth-js 2.112) answers getSession() with `session: null`
// once the access token has really expired (about an hour) and the refresh
// fails, even when the failure is just "no network". The session is still
// in storage (auth-js only removes it on a non-retryable failure), so we
// fall back to the stored copy: the app keeps the user, the local data and
// the offline screens, and auth-js refreshes it for real once back online
// (its auto-refresh emits TOKEN_REFRESHED, which replaces this copy).
//
// Never used to grant anything server-side: every request still carries the
// real token, and RLS rejects a stale one.

export function isNetworkAuthError(error, online = globalThis.navigator?.onLine !== false) {
  if (!error) return false;
  if (!online) return true;
  return error.name === 'AuthRetryableFetchError' || /failed to fetch|network|load failed|fetch failed/i.test(String(error.message ?? ''));
}

export function readStoredSession(storage, storageKey) {
  if (!storage || !storageKey) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Must look like a real session with a user, or we'd sign in a ghost.
    return session?.access_token && session?.refresh_token && session?.user?.id ? session : null;
  } catch {
    return null;
  }
}
