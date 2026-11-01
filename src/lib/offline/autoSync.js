// When the sync engine runs. Deliberately not Background Sync, which iOS
// doesn't support: everything happens while the app is open.
//
//   - right away (app open / sign-in)
//   - the browser's 'online' event (offline -> online)
//   - the tab becoming visible again
//   - shortly after a local write, when online (requestSync)
//   - every `intervalMs` while open and visible
//
// The engine itself refuses concurrent runs, so overlapping triggers are
// harmless. `target`, `doc` and the timer functions are injectable for tests.

export function startAutoSync(engine, {
  target = globalThis.window,
  doc = globalThis.document,
  isOnline = () => globalThis.navigator?.onLine !== false,
  intervalMs = 60_000,
  debounceMs = 1_500,
  setInterval: setIntervalFn = globalThis.setInterval,
  clearInterval: clearIntervalFn = globalThis.clearInterval,
  setTimeout: setTimeoutFn = globalThis.setTimeout,
  clearTimeout: clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  const run = () => engine.sync();
  let debounce = null;

  const onOnline = () => run();
  const onOffline = () => engine.refreshCounts({ state: 'offline' });
  const onVisible = () => { if (doc?.visibilityState === 'visible') run(); };

  target?.addEventListener('online', onOnline);
  target?.addEventListener('offline', onOffline);
  doc?.addEventListener('visibilitychange', onVisible);
  const timer = setIntervalFn(() => {
    if (doc?.visibilityState !== 'hidden' && isOnline()) run();
  }, intervalMs);

  run();

  return {
    // Call after a local write: syncs soon if online, batching a burst of
    // edits into one run. Offline it just updates the pending count.
    requestSync() {
      if (!isOnline()) {
        engine.refreshCounts({ state: 'offline' });
        return;
      }
      if (debounce) clearTimeoutFn(debounce);
      debounce = setTimeoutFn(() => { debounce = null; run(); }, debounceMs);
    },
    stop() {
      target?.removeEventListener('online', onOnline);
      target?.removeEventListener('offline', onOffline);
      doc?.removeEventListener('visibilitychange', onVisible);
      clearIntervalFn(timer);
      if (debounce) clearTimeoutFn(debounce);
    },
  };
}
