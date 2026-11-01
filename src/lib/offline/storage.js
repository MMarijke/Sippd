// Storage for the offline copy. Collections with photos can get large, and
// browsers may evict "best-effort" storage under pressure (iOS Safari
// especially: see OFFLINE.md, known limitations), so we ask for persistent
// storage once, and treat quota errors as a message, not a crash.

export async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
  try {
    if (!storage?.persist) return false;
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

export function isQuotaError(error) {
  if (!error) return false;
  // Dexie wraps the browser's QuotaExceededError (e.g. in an AbortError).
  return [error.name, error.inner?.name].includes('QuotaExceededError') || /quota/i.test(String(error.message ?? ''));
}

export const QUOTA_MESSAGE =
  "Your device is out of space for Sippd's offline copy. Free up some storage, or reconnect so your changes can sync.";
