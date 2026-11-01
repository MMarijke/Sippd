import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, resetFakeDb } from '../_test/fake-supabase.js';
import { sentryEvents } from '../_test/fake-sentry.js';
import { rateLimit } from '../_test/fake-upstash.js';
import { loadFunction, unloadGlobals } from '../_test/harness.js';

// The real get-subscription-status/index.ts against an in-memory database
// and a stubbed Paddle API (see ../_test/).

const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'pro@sippd.test' };
const TOKEN = 'user-jwt';
const SUB_ID = 'sub_01test';

const ENV = {
  PADDLE_API_KEY: 'pdl_test_apikey',
  PADDLE_API_ENVIRONMENT: 'sandbox',
  SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
  UPSTASH_REDIS_REST_URL: 'https://redis.test',
  UPSTASH_REDIS_REST_TOKEN: 'redis-token',
};

let paddle; // (url, init) => Response
let fn;

const subscription = (extra = {}) => ({
  id: SUB_ID,
  status: 'active',
  next_billed_at: '2026-12-01T00:00:00Z',
  scheduled_change: null,
  management_urls: { update_payment_method: 'https://sandbox-buyer-portal.paddle.com/update', cancel: 'https://sandbox-buyer-portal.paddle.com/cancel' },
  ...extra,
});

const call = (init = {}) =>
  fn.call(new Request('https://fake.supabase.co/functions/v1/get-subscription-status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    ...init,
  }));

beforeEach(async () => {
  resetFakeDb();
  sentryEvents.length = 0;
  rateLimit.blocked = false;
  rateLimit.calls.length = 0;
  fakeDb.users[TOKEN] = USER;
  fakeDb.tables.profiles.push({ id: USER.id, subscription_status: 'pro', paddle_subscription_id: SUB_ID });
  paddle = () => new Response(JSON.stringify({ data: subscription() }));
  vi.stubGlobal('fetch', vi.fn(async (url, init) => paddle(String(url), init)));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fn = await loadFunction('get-subscription-status', ENV);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  unloadGlobals();
});

describe('environment', () => {
  it('refuses to start without PADDLE_API_ENVIRONMENT', async () => {
    await expect(loadFunction('get-subscription-status', { ...ENV, PADDLE_API_ENVIRONMENT: undefined })).rejects.toThrow(/PADDLE_API_ENVIRONMENT/);
  });

  it('refuses to start with an unrecognised PADDLE_API_ENVIRONMENT instead of guessing sandbox', async () => {
    await expect(loadFunction('get-subscription-status', { ...ENV, PADDLE_API_ENVIRONMENT: 'live' })).rejects.toThrow(/PADDLE_API_ENVIRONMENT/);
  });

  it('sandbox talks to the sandbox API, production to the live API, with the API key', async () => {
    await call();
    expect(fetch).toHaveBeenLastCalledWith(`https://sandbox-api.paddle.com/subscriptions/${SUB_ID}`, { headers: { Authorization: 'Bearer pdl_test_apikey' } });
    fn = await loadFunction('get-subscription-status', { ...ENV, PADDLE_API_ENVIRONMENT: 'production' });
    await call();
    expect(fetch).toHaveBeenLastCalledWith(`https://api.paddle.com/subscriptions/${SUB_ID}`, expect.anything());
  });
});

describe('request handling', () => {
  it('answers the CORS preflight', async () => {
    const res = await call({ method: 'OPTIONS' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-headers')).toMatch(/authorization/);
  });

  it('only accepts POST', async () => {
    expect((await call({ method: 'GET' })).status).toBe(405);
  });

  it('401 without a token, and with a token that is not a session', async () => {
    expect((await call({ headers: {} })).status).toBe(401);
    expect((await call({ headers: { Authorization: 'Bearer forged' } })).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rate-limits per user before calling Paddle', async () => {
    rateLimit.blocked = true;
    expect((await call()).status).toBe(429);
    expect(rateLimit.calls).toEqual([USER.id]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads the profile as the caller (RLS), never with the service role', async () => {
    await call();
    const read = fakeDb.calls.find((c) => c.table === 'profiles');
    expect(read.key).toBe(ENV.SUPABASE_ANON_KEY);
    expect(read.filters).toEqual([['id', USER.id]]);
  });

  it('404 for a user with no subscription on file', async () => {
    fakeDb.tables.profiles[0].paddle_subscription_id = null;
    const res = await call();
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('response', () => {
  it('maps an active subscription', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'active',
      next_billing_date: '2026-12-01T00:00:00Z',
      cancel_at: null,
      manage_url: 'https://sandbox-buyer-portal.paddle.com/update',
    });
  });

  it('reports a scheduled cancellation date', async () => {
    paddle = () => new Response(JSON.stringify({ data: subscription({ scheduled_change: { action: 'cancel', effective_at: '2026-12-15T00:00:00Z' } }) }));
    expect((await (await call()).json()).cancel_at).toBe('2026-12-15T00:00:00Z');
  });

  it('a scheduled pause is not a cancellation', async () => {
    paddle = () => new Response(JSON.stringify({ data: subscription({ scheduled_change: { action: 'pause', effective_at: '2026-12-15T00:00:00Z' } }) }));
    expect((await (await call()).json()).cancel_at).toBeNull();
  });

  it('gives the user a way to cancel, not only to update their card', async () => {
    const body = await (await call()).json();
    expect(body.cancel_url).toBe('https://sandbox-buyer-portal.paddle.com/cancel');
  });

  it('copes with a subscription that has no management links', async () => {
    paddle = () => new Response(JSON.stringify({ data: subscription({ management_urls: null }) }));
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).manage_url).toBeNull();
  });

  it('a Paddle error is a 500 reported to Sentry, without leaking Paddle\'s response or the API key', async () => {
    paddle = () => new Response(JSON.stringify({ error: { code: 'not_found', detail: 'secret detail' } }), { status: 404 });
    const res = await call();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/secret detail|pdl_test_apikey/);
    expect(sentryEvents).toHaveLength(1);
  });

  it('never returns the API key on success either', async () => {
    expect(await (await call()).text()).not.toContain('pdl_test_apikey');
  });
});
