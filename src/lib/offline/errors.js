// How the sync engine treats a failed push (see sync.js):
//
//   'retry'  the network or server hiccupped: back off and try again, up to
//            MAX_ATTEMPTS, then mark the entry failed.
//   'limit'  a server rule said not now (the free 10-scans-a-day cap, the
//            30-adds-an-hour limit): mark it failed straight away with a
//            message the user can act on; Retry works once the limit lifts.
//   'fatal'  the server rejected the write itself (validation, RLS, a
//            locked column): mark it failed straight away, no retries.

const LIMITS = {
  daily_scan_limit_reached:
    "You've scanned 10 barcodes in the last 24 hours, the free daily limit. This can will sync once the oldest scan is a day old, or with Pro.",
  rate_limit_exceeded: "You've added 30 cans in the last hour. This can will sync after a short break.",
};

const NETWORK_PATTERNS = /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|offline/i;

export function classifyError(error) {
  if (!error) return { kind: 'fatal', message: 'Unknown error' };
  const message = String(error.message ?? error);
  for (const [code, friendly] of Object.entries(LIMITS)) {
    if (message.includes(code)) return { kind: 'limit', code, message: friendly };
  }
  const status = Number(error.status ?? error.statusCode ?? NaN);
  if (
    error.name === 'TypeError' ||
    error.name === 'AuthRetryableFetchError' ||
    NETWORK_PATTERNS.test(message) ||
    status === 0 || status === 408 || status === 429 || status >= 500
  ) {
    return { kind: 'retry', message };
  }
  return { kind: 'fatal', message };
}

export const MAX_ATTEMPTS = 5;

// 2s, 4s, 8s, 16s, 32s... capped at 5 minutes, with a little jitter so many
// devices coming back online at once don't all hit the server together.
export function backoffMs(attempts, random = Math.random) {
  const base = Math.min(2 ** attempts * 1000, 5 * 60 * 1000);
  return Math.round(base * (0.8 + random() * 0.4));
}
