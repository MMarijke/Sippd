import { test, expect } from '@playwright/test';

// Offline smoke test against the production build (service worker active),
// the automated half of OFFLINE.md's manual checklist: the shell opens
// offline, a can with a photo can be added offline, online-only screens
// say so, and on reconnect the photo uploads before the row that uses it.
//
// Like smoke.spec.js, every Supabase call is answered by an in-test fake
// (context.route, so requests from the service worker are covered too):
// this never reaches the linked project.

const FAKE_USER_ID = '22222222-2222-2222-2222-222222222222';
const CATALOG_CAN_ID = '33333333-3333-3333-3333-333333333333';

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const farFuture = () => Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;

// 8x8 red PNG, so the form's compressor has a real image to decode.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
  'base64'
);

async function fakeBackend(context) {
  const calls = []; // in arrival order: 'upload', 'vote', 'upsert'
  const server = { rows: [] };

  await context.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    {
      key: 'sb-e2e-placeholder-auth-token',
      session: {
        access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: FAKE_USER_ID, role: 'authenticated', aud: 'authenticated', exp: farFuture() })}.fake`,
        token_type: 'bearer',
        expires_in: 60 * 60 * 24 * 365,
        expires_at: farFuture(),
        refresh_token: 'fake-refresh-token',
        user: { id: FAKE_USER_ID, aud: 'authenticated', role: 'authenticated', email: 'e2e-offline@sippd.test', created_at: '2026-01-01T00:00:00Z' },
      },
    }
  );

  await context.route('**/storage/v1/object/public/**', (route) => route.fulfill({ body: PNG, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
  await context.route('**/storage/v1/object/can-images/**', (route) => {
    calls.push({ kind: 'upload', path: new URL(route.request().url()).pathname });
    return route.fulfill({ json: { Key: 'can-images/x' } });
  });
  await context.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    if (pathname.endsWith('/rpc/vote_on_can')) {
      calls.push({ kind: 'vote', body: req.postDataJSON() });
      return route.fulfill({ json: { id: CATALOG_CAN_ID, name: 'Offline Test Can', brand: 'E2E', consensus_rarity: 'Common' } });
    }
    if (pathname.endsWith('/rpc/sync_upsert_user_collection')) {
      const row = req.postDataJSON().p_row;
      calls.push({ kind: 'upsert', row });
      server.rows = [...server.rows.filter((r) => r.id !== row.id), row];
      return route.fulfill({ json: row });
    }
    if (pathname.endsWith('/user_collection') && req.method() === 'GET') return route.fulfill({ json: server.rows });
    return route.fulfill({ json: [] });
  });

  return { calls, server };
}

test('works offline: shell, add a can with a photo, online-only notices, sync on reconnect', async ({ context, page }) => {
  const { calls, server } = await fakeBackend(context);

  // Online first visit: the service worker installs and precaches the app.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SIPPD' })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 });

  // Offline: a reload is served from the precache, still signed in.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'SIPPD' })).toBeVisible();

  // Add a brand-new can, with a photo, entirely offline.
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Name').fill('Offline Test Can');
  await page.getByLabel('Brand').fill('E2E');
  const vote = page.getByRole('group', { name: 'Your rarity vote' });
  await vote.getByRole('button', { name: 'Common', exact: true }).click();
  await vote.getByRole('button', { name: 'Confirm Common', exact: true }).click();
  await page.getByRole('button', { name: 'Show personalize fields' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'can.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('button', { name: 'Remove image' })).toBeVisible();
  await page.getByRole('button', { name: /Add to Vault/ }).click();
  await page.getByRole('button', { name: 'View Collection' }).click();

  await expect(page).toHaveURL(/\/collection/);
  await expect(page.getByText('Offline Test Can').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Sync status: Offline · 1 to sync/ })).toBeVisible();
  expect(calls).toEqual([]); // nothing left the device

  // Queued in order: the photo upload before the row that references it.
  const outbox = await page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('outbox').objectStore('outbox').getAll();
          all.onsuccess = () => resolve(all.result.map((e) => e.kind));
        };
      }),
    `sippd-offline-${FAKE_USER_ID}`
  );
  expect(outbox).toEqual(['blob.upload', 'collection.add']);

  // Online-only screens say so instead of failing.
  await page.goto('/trades');
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();

  // Back online: it syncs by itself, photo first. (Navigate first: leaving
  // a page mid-sync replays the in-flight entry on the next page, which is
  // safe, since uploads are idempotent, but would make the call list racy.)
  await page.goto('/collection');
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Sync status: Synced' })).toBeVisible({ timeout: 30_000 });

  expect(calls.map((c) => c.kind)).toEqual(['upload', 'vote', 'upsert']);
  expect(calls[0].path).toContain(`/can-images/${FAKE_USER_ID}/`);
  const { row } = calls[2];
  expect(row.can_id).toBe(CATALOG_CAN_ID);
  expect(row.can_image_url).toContain(`/can-images/${FAKE_USER_ID}/`);
  expect(calls[1].body.p_image_url).toBe(row.can_image_url);
  expect(server.rows).toHaveLength(1);

  // Offline search finds cans saved on this device, and doesn't claim a
  // can is missing from the catalog (which would invite a duplicate).
  await context.setOffline(true);
  await page.goto('/scan');
  await page.getByLabel('Search cans by name, brand or barcode').fill('offline test');
  await expect(page.getByText("You're offline, so only cans saved on this device are searched.")).toBeVisible();
  await expect(page.getByRole('button', { name: /Offline Test Can/ })).toBeVisible();
  await page.getByLabel('Search cans by name, brand or barcode').fill('zzz nothing');
  await expect(page.getByText(/No saved cans match "zzz nothing"/)).toBeVisible();
});
