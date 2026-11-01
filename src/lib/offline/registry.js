import { deleteUserDb } from './db';
import { clearProCache } from './proCache';

// The one live offline session (OfflineProvider registers it), so sign-out,
// which lives in useAuth outside that provider, can stop syncing and close
// the database before deleting it (an open IndexedDB database would make
// the delete wait forever).
let active = null;

export function registerOffline(handle) {
  active = handle;
  return () => { if (active === handle) active = null; };
}

// Explicit sign-out only: wipes this user's local copy, queued writes and
// cached Pro status from the device.
export async function clearOfflineData(userId) {
  if (!userId) return;
  if (active?.userId === userId) {
    await active.close();
    active = null;
  }
  await deleteUserDb(userId);
  clearProCache(userId);
}
