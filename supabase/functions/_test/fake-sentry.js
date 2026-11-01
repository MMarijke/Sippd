// Records what _shared/sentry.ts would have sent, so tests can assert a
// failure was reported (and not silently swallowed).
export const sentryEvents = (globalThis.__fakeSentryEvents ??= []); // shared, see fake-supabase.js

export const init = () => {};
export const setTag = () => {};
export const setContext = () => {};
export const flush = async () => true;
export const captureException = (err) => { sentryEvents.push(err); };
