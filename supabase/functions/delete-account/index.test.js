import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, resetFakeDb } from '../_test/fake-supabase.js';
import { sentryEvents } from '../_test/fake-sentry.js';
import { rateLimit } from '../_test/fake-upstash.js';
import { loadFunction, unloadGlobals } from '../_test/harness.js';

// delete-account/index.ts, the subscription side: deleting an account must
// cancel its Paddle subscription first, or the user keeps being charged for
// an account that no longer exists.

const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'pro@sippd.test' };
const TOKEN = 'user-jwt';
const SUB_ID = 'sub_01test';
const API = 'https://sandbox-api.paddle.com';

const ENV = {
  PADDLE_API_KEY: 'pdl_test_apikey',
  PADDLE_API_ENVIRONMENT: 'sandbox',
  SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  UPSTASH_REDIS_REST_URL: 'https://redis.test',
  UPSTASH_REDIS_REST_TOKEN: 'redis-token',
};

let paddleStatus;
let cancelResponse;
let fn;

const call = (headers = { Authorization: `Bearer ${TOKEN}` }) =>
  fn.call(new Request('https://fake.supabase.co/functions/v1/delete-account', { method: 'POST', headers }));

const paddleCalls = () => fetch.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`);

beforeEach(async () => {
  resetFakeDb();
  sentryEvents.length = 0;
  rateLimit.blocked = false;
  fakeDb.users[TOKEN] = USER;
  fakeDb.tables.profiles.push({ id: USER.id, paddle_subscription_id: SUB_ID });
  paddleStatus = 'active';
  cancelResponse = () => new Response(JSON.stringify({ data: { id: SUB_ID, status: 'canceled' } }));
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (init?.method === 'POST') return cancelResponse();
    return new Response(JSON.stringify({ data: { id: SUB_ID, status: paddleStatus } }));
  }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fn = await loadFunction('delete-account', ENV);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  unloadGlobals();
});

it('cancels an active subscription immediately, then deletes the account', async () => {
  const res = await call();
  expect(res.status).toBe(200);
  expect(paddleCalls()).toEqual([`GET ${API}/subscriptions/${SUB_ID}`, `POST ${API}/subscriptions/${SUB_ID}/cancel`]);
  const [, init] = fetch.mock.calls[1];
  expect(JSON.parse(init.body)).toEqual({ effective_from: 'immediately' });
  expect(init.headers.Authorization).toBe('Bearer pdl_test_apikey');
  expect(fakeDb.deletedUsers).toEqual([USER.id]);
});

it.each(['past_due', 'paused', 'trialing'])('also cancels a %s subscription', async (status) => {
  paddleStatus = status;
  await call();
  expect(paddleCalls()).toContain(`POST ${API}/subscriptions/${SUB_ID}/cancel`);
  expect(fakeDb.deletedUsers).toEqual([USER.id]);
});

it('does not cancel twice when the subscription is already canceled', async () => {
  paddleStatus = 'canceled';
  expect((await call()).status).toBe(200);
  expect(paddleCalls()).toEqual([`GET ${API}/subscriptions/${SUB_ID}`]);
  expect(fakeDb.deletedUsers).toEqual([USER.id]);
});

it('a free user is deleted without calling Paddle', async () => {
  fakeDb.tables.profiles[0].paddle_subscription_id = null;
  expect((await call()).status).toBe(200);
  expect(fetch).not.toHaveBeenCalled();
  expect(fakeDb.deletedUsers).toEqual([USER.id]);
});

it('keeps the account when the cancellation fails, so it is never deleted while still billing', async () => {
  cancelResponse = () => new Response(JSON.stringify({ error: { code: 'internal_error' } }), { status: 500 });
  const res = await call();
  expect(res.status).toBe(502);
  expect((await res.json()).error).toMatch(/cancel your subscription/);
  expect(fakeDb.deletedUsers).toEqual([]);
  expect(sentryEvents).toHaveLength(1);
});

it('keeps the account when Paddle cannot even be asked about the subscription', async () => {
  vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify({ error: {} }), { status: 503 }));
  expect((await call()).status).toBe(502);
  expect(fakeDb.deletedUsers).toEqual([]);
});

it('keeps the account when the profile cannot be read (it can\'t know whether to cancel)', async () => {
  fakeDb.failures.push({ table: 'profiles', op: 'select', error: { code: '57014', message: 'timeout' } });
  expect((await call()).status).toBe(500);
  expect(fetch).not.toHaveBeenCalled();
  expect(fakeDb.deletedUsers).toEqual([]);
});

it('deletes only the caller, using the service role only for that', async () => {
  await call();
  const del = fakeDb.calls.find((c) => c.op === 'deleteUser');
  expect(del).toMatchObject({ id: USER.id, key: ENV.SUPABASE_SERVICE_ROLE_KEY });
  const read = fakeDb.calls.find((c) => c.table === 'profiles');
  expect(read.key).toBe(ENV.SUPABASE_ANON_KEY);
});

it('rejects unauthenticated and rate-limited calls before touching Paddle', async () => {
  expect((await call({})).status).toBe(401);
  expect((await call({ Authorization: 'Bearer forged' })).status).toBe(401);
  rateLimit.blocked = true;
  expect((await call()).status).toBe(429);
  expect(fetch).not.toHaveBeenCalled();
  expect(fakeDb.deletedUsers).toEqual([]);
});

it('refuses to start unless PADDLE_API_ENVIRONMENT is exactly sandbox or production', async () => {
  for (const value of [undefined, 'live', 'prod', 'Production']) {
    await expect(loadFunction('delete-account', { ...ENV, PADDLE_API_ENVIRONMENT: value })).rejects.toThrow(/PADDLE_API_ENVIRONMENT/);
  }
});
