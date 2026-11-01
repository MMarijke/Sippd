import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, resetFakeDb } from '../_test/fake-supabase.js';
import { sentryEvents } from '../_test/fake-sentry.js';
import { loadFunction, unloadGlobals } from '../_test/harness.js';

// The real paddle-webhook/index.ts, run in Node against an in-memory
// database (see ../_test/). Paddle's signing scheme is reproduced exactly:
// Paddle-Signature: ts=<unix seconds>;h1=<hex HMAC-SHA256 of "<ts>:<body>">.

const SECRET = 'pdl_ntfset_test_secret';
const PADDLE_IP = '34.232.58.13';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const SUB_ID = 'sub_01test';
const CUSTOMER_ID = 'ctm_01test';

const ENV = {
  PADDLE_WEBHOOK_SECRET: SECRET,
  SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
};

let ipsResponse;
let fn;
let seq = 0;

const nowSec = () => Math.floor(Date.now() / 1000);
const sign = (body, { ts = nowSec(), secret = SECRET } = {}) =>
  `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')}`;

function event(type, data, overrides = {}) {
  seq += 1;
  return { event_id: `evt_${seq}`, event_type: type, occurred_at: new Date().toISOString(), data, ...overrides };
}

const activated = (extra = {}, overrides = {}) =>
  event('subscription.activated', { id: SUB_ID, customer_id: CUSTOMER_ID, status: 'active', custom_data: { user_id: USER_ID }, scheduled_change: null, ...extra }, overrides);
const updated = (extra = {}) =>
  event('subscription.updated', { id: SUB_ID, customer_id: CUSTOMER_ID, status: 'active', scheduled_change: null, ...extra });
const canceled = (extra = {}) =>
  event('subscription.canceled', { id: SUB_ID, customer_id: CUSTOMER_ID, status: 'canceled', canceled_at: '2026-12-01T00:00:00.000Z', scheduled_change: null, ...extra });

function request(evt, { ip = PADDLE_IP, signature, headers = {}, rawBody } = {}) {
  const body = rawBody ?? JSON.stringify(evt);
  return new Request('https://fake.supabase.co/functions/v1/paddle-webhook', {
    method: 'POST',
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1`, 'paddle-signature': signature ?? sign(body), ...headers },
    body,
  });
}

async function deliver(evt, opts) {
  const res = await fn.call(request(evt, opts));
  await fn.settle();
  return res;
}

const profile = () => fakeDb.tables.profiles.find((p) => p.id === USER_ID);
const loggedEvent = (evt) => fakeDb.tables.paddle_events.find((e) => e.event_id === evt.event_id);

beforeEach(async () => {
  resetFakeDb();
  sentryEvents.length = 0;
  fakeDb.tables.profiles.push({ id: USER_ID, subscription_status: 'free', paddle_subscription_id: null, paddle_customer_id: null, pro_expires_at: null });
  ipsResponse = () => new Response(JSON.stringify({ data: { ipv4_cidrs: ['34.232.58.0/24', '34.195.105.136/32'] } }));
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url) === 'https://api.paddle.com/ips') return ipsResponse();
    throw new Error(`unexpected fetch ${url}`);
  }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fn = await loadFunction('paddle-webhook', ENV);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  unloadGlobals();
});

describe('IP allowlist', () => {
  it('accepts a request from a Paddle IP (first x-forwarded-for hop)', async () => {
    expect((await deliver(activated())).status).toBe(200);
  });

  it('rejects any other IP with 403 before reading the body', async () => {
    const res = await deliver(activated(), { ip: '203.0.113.9' });
    expect(res.status).toBe(403);
    expect(fakeDb.tables.paddle_events).toHaveLength(0);
  });

  it('rejects a request with no client IP at all', async () => {
    const evt = activated();
    const body = JSON.stringify(evt);
    const req = new Request('https://x/paddle-webhook', { method: 'POST', headers: { 'paddle-signature': sign(body) }, body });
    expect((await fn.call(req)).status).toBe(403);
  });

  it('falls back to x-real-ip', async () => {
    const evt = activated();
    const body = JSON.stringify(evt);
    const req = new Request('https://x/paddle-webhook', { method: 'POST', headers: { 'x-real-ip': PADDLE_IP, 'paddle-signature': sign(body) }, body });
    expect((await fn.call(req)).status).toBe(200);
  });

  it('fails closed on a cold start when Paddle\'s IP list cannot be fetched', async () => {
    ipsResponse = () => new Response('down', { status: 503 });
    expect((await deliver(activated())).status).toBe(403);
    expect(sentryEvents).toHaveLength(1);
  });

  it('keeps using the last good list when a later refresh fails', async () => {
    expect((await deliver(activated())).status).toBe(200);
    ipsResponse = () => new Response('down', { status: 503 });
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000); // past the 1 h cache
    try {
      expect((await deliver(updated())).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caches the list instead of fetching it on every delivery', async () => {
    await deliver(activated());
    await deliver(updated());
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('signature verification', () => {
  it('rejects a missing signature', async () => {
    const res = await deliver(activated(), { signature: '' });
    expect(res.status).toBe(400);
    expect(fakeDb.tables.paddle_events).toHaveLength(0);
  });

  it('rejects a signature made with another secret', async () => {
    const evt = activated();
    const res = await deliver(evt, { signature: sign(JSON.stringify(evt), { secret: 'wrong' }) });
    expect(res.status).toBe(400);
    expect(profile().subscription_status).toBe('free');
  });

  it('rejects a body changed after signing', async () => {
    const evt = activated();
    const signature = sign(JSON.stringify(evt));
    const forged = JSON.stringify({ ...evt, data: { ...evt.data, custom_data: { user_id: 'someone-else' } } });
    expect((await deliver(evt, { signature, rawBody: forged })).status).toBe(400);
  });

  it('rejects a replay older than 5 minutes, even with a valid hash', async () => {
    const evt = activated();
    const res = await deliver(evt, { signature: sign(JSON.stringify(evt), { ts: nowSec() - 301 }) });
    expect(res.status).toBe(400);
  });

  it('rejects a timestamp too far in the future', async () => {
    const evt = activated();
    expect((await deliver(evt, { signature: sign(JSON.stringify(evt), { ts: nowSec() + 301 }) })).status).toBe(400);
  });

  it('accepts a signature within the 5-minute window', async () => {
    const evt = activated();
    expect((await deliver(evt, { signature: sign(JSON.stringify(evt), { ts: nowSec() - 120 }) })).status).toBe(200);
  });

  it('accepts any matching h1 while the secret is being rotated', async () => {
    const evt = activated();
    const body = JSON.stringify(evt);
    const ts = nowSec();
    const good = sign(body, { ts }).split(';h1=')[1];
    const res = await deliver(evt, { signature: `ts=${ts};h1=${'0'.repeat(64)};h1=${good}` });
    expect(res.status).toBe(200);
  });

  it('rejects malformed headers without throwing', async () => {
    for (const signature of ['garbage', 'ts=abc;h1=00', `ts=${nowSec()}`, `h1=${'a'.repeat(64)}`, `ts=${nowSec()};h1=short`]) {
      expect((await deliver(activated(), { signature })).status).toBe(400);
    }
  });
});

describe('subscription.activated', () => {
  it('grants Pro and stores the Paddle ids, resolving the user from custom_data', async () => {
    const evt = activated();
    await deliver(evt);
    expect(profile()).toMatchObject({ subscription_status: 'pro', paddle_subscription_id: SUB_ID, paddle_customer_id: CUSTOMER_ID, pro_expires_at: null });
    expect(loggedEvent(evt)).toMatchObject({ event_type: 'subscription.activated', processed: true });
  });

  it('writes with the service-role client (the lock trigger only lets service_role change billing columns)', async () => {
    await deliver(activated());
    const write = fakeDb.calls.find((c) => c.table === 'profiles' && c.op === 'update');
    expect(write.key).toBe(ENV.SUPABASE_SERVICE_ROLE_KEY);
  });

  it('clears an old expiry when a lapsed user resubscribes', async () => {
    Object.assign(profile(), { subscription_status: 'cancelled', paddle_subscription_id: 'sub_old', pro_expires_at: '2026-01-01T00:00:00Z' });
    await deliver(activated());
    expect(profile()).toMatchObject({ subscription_status: 'pro', paddle_subscription_id: SUB_ID, pro_expires_at: null });
  });

  it('reports to Sentry (not just the log) when custom_data.user_id is missing: a paying customer would not get Pro', async () => {
    const evt = activated({ custom_data: null });
    expect((await deliver(evt)).status).toBe(200);
    expect(profile().subscription_status).toBe('free');
    expect(sentryEvents.length).toBeGreaterThan(0);
    expect(loggedEvent(evt).processed).toBe(false);
  });
});

describe('subscription.updated', () => {
  beforeEach(async () => { await deliver(activated()); });

  it('a scheduled cancellation keeps Pro until the period ends', async () => {
    await deliver(updated({ scheduled_change: { action: 'cancel', effective_at: '2026-12-15T00:00:00Z' } }));
    expect(profile()).toMatchObject({ subscription_status: 'pro', pro_expires_at: '2026-12-15T00:00:00Z' });
  });

  it('undoing the cancellation clears the expiry', async () => {
    await deliver(updated({ scheduled_change: { action: 'cancel', effective_at: '2026-12-15T00:00:00Z' } }));
    await deliver(updated({ scheduled_change: null }));
    expect(profile()).toMatchObject({ subscription_status: 'pro', pro_expires_at: null });
  });

  it('a scheduled pause is not treated as a cancellation', async () => {
    await deliver(updated({ scheduled_change: { action: 'pause', effective_at: '2026-12-15T00:00:00Z' } }));
    expect(profile()).toMatchObject({ subscription_status: 'pro', pro_expires_at: null });
  });

  it('trialing counts as Pro', async () => {
    await deliver(updated({ status: 'trialing' }));
    expect(profile().subscription_status).toBe('pro');
  });

  it('past_due and paused leave access unchanged (canceled owns revocation)', async () => {
    await deliver(updated({ status: 'past_due' }));
    expect(profile()).toMatchObject({ subscription_status: 'pro', pro_expires_at: null });
    await deliver(updated({ status: 'paused' }));
    expect(profile().subscription_status).toBe('pro');
  });

  it('only touches the profile that owns the subscription', async () => {
    fakeDb.tables.profiles.push({ id: 'other', subscription_status: 'free', paddle_subscription_id: 'sub_other', pro_expires_at: null });
    await deliver(updated({ scheduled_change: { action: 'cancel', effective_at: '2026-12-15T00:00:00Z' } }));
    expect(fakeDb.tables.profiles.find((p) => p.id === 'other')).toMatchObject({ subscription_status: 'free', pro_expires_at: null });
  });

  it('an update for a subscription no profile owns yet is reported and retried (it may be ahead of its activated)', async () => {
    const res = await deliver(updated({ id: 'sub_unknown' }));
    expect(res.status).toBe(500);
    expect(sentryEvents.length).toBeGreaterThan(0);
  });

  it('delivered before its activated, an update is applied when Paddle redelivers it', async () => {
    fakeDb.tables.profiles.push({ id: 'early', subscription_status: 'free', paddle_subscription_id: null, pro_expires_at: null });
    const early = event('subscription.updated', { id: 'sub_early', status: 'active', scheduled_change: { action: 'cancel', effective_at: '2026-12-31T00:00:00Z' } });
    expect((await deliver(early)).status).toBe(500);
    await deliver(event('subscription.activated', { id: 'sub_early', customer_id: 'ctm_early', status: 'active', custom_data: { user_id: 'early' } }));
    expect((await deliver(early)).status).toBe(200); // Paddle's retry of the same event
    expect(fakeDb.tables.profiles.find((p) => p.id === 'early')).toMatchObject({ subscription_status: 'pro', pro_expires_at: '2026-12-31T00:00:00Z' });
  });
});

describe('subscription.canceled', () => {
  beforeEach(async () => { await deliver(activated()); });

  it('revokes Pro, recording when it ended', async () => {
    await deliver(canceled());
    expect(profile()).toMatchObject({ subscription_status: 'cancelled', pro_expires_at: '2026-12-01T00:00:00.000Z' });
  });

  it('a cancel for a subscription no profile owns is reported and retried', async () => {
    expect((await deliver(canceled({ id: 'sub_unknown' }))).status).toBe(500);
    expect(sentryEvents.length).toBeGreaterThan(0);
  });

  it('falls back to now when Paddle sends no canceled_at', async () => {
    const before = Date.now();
    await deliver(canceled({ canceled_at: undefined }));
    expect(profile().subscription_status).toBe('cancelled');
    expect(Date.parse(profile().pro_expires_at)).toBeGreaterThanOrEqual(before - 1000);
  });

  it('keeps the Paddle ids so a later resubscribe links to the same customer', async () => {
    await deliver(canceled());
    expect(profile()).toMatchObject({ paddle_subscription_id: SUB_ID, paddle_customer_id: CUSTOMER_ID });
  });
});

describe('idempotency and delivery order', () => {
  it('a duplicate delivery is acknowledged and not processed again', async () => {
    const evt = activated();
    await deliver(evt);
    Object.assign(profile(), { subscription_status: 'cancelled' }); // changed since
    const res = await deliver(evt);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/duplicate/);
    expect(profile().subscription_status).toBe('cancelled');
  });

  it('logs every event, including types it does not act on', async () => {
    const evt = event('transaction.completed', { id: 'txn_1' });
    await deliver(evt);
    expect(loggedEvent(evt)).toMatchObject({ event_type: 'transaction.completed', processed: true });
    expect(profile().subscription_status).toBe('free');
  });

  it('a late, retried activated never re-grants a subscription that was already canceled', async () => {
    const first = activated();
    await deliver(first);
    await deliver(canceled());
    // Paddle redelivers activated with a NEW event id if the first delivery
    // failed on its side, and deliveries are not guaranteed to be in order.
    await deliver(activated({}, { event_id: `evt_retry_${seq}` }));
    expect(profile().subscription_status).toBe('cancelled');
  });

  it('a late subscription.updated (still active) never re-grants a canceled subscription', async () => {
    await deliver(activated());
    const stale = updated(); // created before the cancel, delivered after
    await deliver(canceled());
    await deliver(stale);
    expect(profile().subscription_status).toBe('cancelled');
  });
});

describe('failures', () => {
  it('asks Paddle to retry (non-2xx) when the event could not be stored', async () => {
    fakeDb.failures.push({ table: 'paddle_events', op: 'insert', error: { code: '08006', message: 'connection failure' } });
    const res = await deliver(activated());
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(sentryEvents.length).toBeGreaterThan(0);
  });

  it('a processing failure is reported and answered 500, so Paddle redelivers it', async () => {
    fakeDb.failures.push({ table: 'profiles', op: 'update', error: { code: '57014', message: 'statement timeout' } });
    const evt = activated();
    expect((await deliver(evt)).status).toBe(500);
    expect(sentryEvents.length).toBeGreaterThan(0);
    expect(loggedEvent(evt).processed).toBe(false);
    expect(profile().subscription_status).toBe('free');

    // The redelivery finds the event logged but unprocessed, and finishes it.
    const retry = await deliver(evt);
    expect(retry.status).toBe(200);
    expect(await retry.text()).not.toMatch(/duplicate/);
    expect(profile().subscription_status).toBe('pro');
    expect(loggedEvent(evt).processed).toBe(true);
  });

  it('after a failed store, the redelivery is processed normally', async () => {
    fakeDb.failures.push({ table: 'paddle_events', op: 'insert', error: { code: '08006', message: 'connection failure' } });
    const evt = activated();
    expect((await deliver(evt)).status).toBe(500);
    expect((await deliver(evt)).status).toBe(200);
    expect(profile().subscription_status).toBe('pro');
  });

  it('rejects a signed but non-JSON body with a 500, without crashing', async () => {
    const rawBody = 'not json';
    const res = await deliver(null, { rawBody, signature: sign(rawBody) });
    expect(res.status).toBe(500);
  });
});
