import { test, expect } from '@playwright/test';
import { FAKE_PADDLE_JS, rest, signIn } from './support/backend.js';

// Subscriptions, client side: the Pro page and Paddle checkout, the
// Settings subscription section, and the Pro gates in the UI. The server
// side (webhook, status function, entitlements) is covered by
// supabase/functions/*/index.test.js and supabase/tests/pro_entitlements_test.sql.
//
// Needs a build with the Paddle placeholders CI sets (see ci.yml's e2e job):
// VITE_PADDLE_ENVIRONMENT=sandbox, VITE_PADDLE_CLIENT_TOKEN=test_e2e_token,
// VITE_PADDLE_MONTHLY_PRICE_ID=pri_e2e_monthly, VITE_PADDLE_ANNUAL_PRICE_ID=pri_e2e_annual.

const USER = { userId: '44444444-4444-4444-4444-444444444444', email: 'collector@sippd.test' };

const PROFILES = {
  free: { subscription_status: 'free', paddle_customer_id: null, paddle_subscription_id: null, pro_expires_at: null },
  pro: { subscription_status: 'pro', paddle_customer_id: 'ctm_01pro', paddle_subscription_id: 'sub_01pro', pro_expires_at: null },
  cancelling: { subscription_status: 'pro', paddle_customer_id: 'ctm_01pro', paddle_subscription_id: 'sub_01pro', pro_expires_at: '2099-12-15T00:00:00Z' },
  lapsed: { subscription_status: 'pro', paddle_customer_id: 'ctm_01pro', paddle_subscription_id: 'sub_01pro', pro_expires_at: '2026-01-01T00:00:00Z' },
  returning: { subscription_status: 'cancelled', paddle_customer_id: 'ctm_returning', paddle_subscription_id: 'sub_old', pro_expires_at: '2026-01-01T00:00:00Z' },
};

const STATUS = {
  active: { status: 'active', next_billing_date: '2026-12-01T00:00:00Z', cancel_at: null, manage_url: 'https://sandbox-buyer-portal.paddle.com/update', cancel_url: 'https://sandbox-buyer-portal.paddle.com/cancel' },
  cancelling: { status: 'active', next_billing_date: null, cancel_at: '2026-12-15T00:00:00Z', manage_url: 'https://sandbox-buyer-portal.paddle.com/update', cancel_url: null },
};

// state.profile can be changed mid-test (e.g. the webhook granting Pro).
async function backend(context, { profile = 'free', status = STATUS.active, statusCode = 200, crates = 0, paddleJs = 'ok' } = {}) {
  const state = { profile: PROFILES[profile], themeWrites: [] };
  await signIn(context, USER);
  await context.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => { window.__opened.push(url); return null; };
  });
  await context.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    if (pathname.endsWith('/profiles')) {
      if (req.method() === 'PATCH') {
        state.themeWrites.push(req.postDataJSON());
        return rest(route, [{ id: USER.userId, ...state.profile, ...req.postDataJSON() }]);
      }
      return rest(route, [{ id: USER.userId, full_name: 'Test Collector', region: null, theme: 'power-up', ...state.profile }]);
    }
    if (pathname.endsWith('/crates')) {
      return rest(route, Array.from({ length: crates }, (_, i) => ({ id: `crate-${i}`, owner_id: USER.userId, name: `Crate ${i + 1}`, emoji: '📦', can_ids: [], created_at: '2026-10-01T00:00:00Z' })));
    }
    return route.fulfill({ json: [] });
  });
  await context.route('**/functions/v1/get-subscription-status', (route) =>
    route.fulfill({ status: statusCode, json: statusCode === 200 ? status : { error: 'Failed to fetch subscription status' } }));
  await context.route('https://cdn.paddle.com/**', (route) =>
    paddleJs === 'ok' ? route.fulfill({ body: FAKE_PADDLE_JS, contentType: 'text/javascript' }) : route.abort());
  return state;
}

const paddle = (page) => page.evaluate(() => window.__paddle);

// Opens a page and waits until the app has its subscription status, so a
// "not shown" assertion can't pass just because the data hadn't arrived.
async function openLoaded(page, path) {
  const loaded = page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.url().includes('subscription_status'));
  await page.goto(path);
  await loaded;
  await page.waitForLoadState('networkidle');
}

test.describe('Pro page and checkout', () => {
  test('a free user sees the plans, and Monthly opens Paddle checkout tied to their account', async ({ context, page }) => {
    await backend(context);
    await page.goto('/pro');
    await expect(page.getByText('Unlimited crates (free: 5 crates, 10 cans each)')).toBeVisible();
    await expect(page.getByRole('link', { name: /terms/i }).first()).toBeVisible(); // Paddle requires terms at checkout

    await page.getByRole('button', { name: /Monthly/ }).click();
    await expect.poll(async () => (await paddle(page))?.checkouts.length).toBe(1);
    const p = await paddle(page);
    expect(p.environment).toBe('sandbox');
    expect(p.init.token).toBe('test_e2e_token');
    expect(p.init.pwCustomer).toBeUndefined(); // never seen by Paddle: no customer id to pass
    expect(p.checkouts[0]).toMatchObject({
      items: [{ priceId: 'pri_e2e_monthly', quantity: 1 }],
      customer: { email: USER.email },
      customData: { user_id: USER.userId }, // how paddle-webhook finds the account
    });
  });

  test("plans show the customer's local price from Paddle", async ({ context, page }) => {
    await backend(context);
    await page.goto('/pro');
    await expect(page.getByRole('button', { name: 'Monthly — R54.99/mo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Annual — R369.99/yr' })).toBeVisible();
  });

  test("if Paddle can't quote a local price, the list price is shown", async ({ context, page }) => {
    await backend(context);
    await context.addInitScript(() => { window.__paddleQuote = 'fail'; });
    await openLoaded(page, '/pro');
    await expect(page.getByRole('button', { name: 'Monthly — $2.99/mo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Annual — $19.99/yr' })).toBeVisible();
  });

  test('Annual opens checkout for the annual price', async ({ context, page }) => {
    await backend(context);
    await page.goto('/pro');
    await page.getByRole('button', { name: /Annual/ }).click();
    await expect.poll(async () => (await paddle(page))?.checkouts[0]?.items[0].priceId).toBe('pri_e2e_annual');
  });

  test('a returning customer is linked to their existing Paddle customer, not duplicated', async ({ context, page }) => {
    await backend(context, { profile: 'returning' });
    await page.goto('/pro');
    await page.getByRole('button', { name: /Monthly/ }).click();
    await expect.poll(async () => (await paddle(page))?.init?.pwCustomer).toEqual({ id: 'ctm_returning' });
  });

  test('if Paddle.js cannot load, the user is told and can try again', async ({ context, page }) => {
    await backend(context, { paddleJs: 'blocked' });
    await page.goto('/pro');
    await page.getByRole('button', { name: /Monthly/ }).click();
    await expect(page.getByText(/Could not open checkout/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Monthly/ })).toBeEnabled();
  });

  test('a Pro user is not offered a second subscription', async ({ context, page }) => {
    await backend(context, { profile: 'pro' });
    await page.goto('/pro');
    await expect(page.getByText("You're already on Pro")).toBeVisible();
    await expect(page.getByRole('button', { name: /Monthly|Annual/ })).toHaveCount(0);
  });

  test('the plans are not offered until the app knows whether the user is already Pro', async ({ context, page }) => {
    await backend(context, { profile: 'pro' });
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await context.route((url) => url.pathname.endsWith('/rest/v1/profiles') && url.search.includes('subscription_status'), async (route) => {
      await held; // the status request is slow
      return route.fallback();
    });
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: 'Sippd Pro' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Monthly|Annual/ })).toHaveCount(0);
    release();
    await expect(page.getByText("You're already on Pro")).toBeVisible();
  });

  test('a subscriber with a scheduled cancellation is still Pro until it ends', async ({ context, page }) => {
    await backend(context, { profile: 'cancelling' });
    await page.goto('/pro');
    await expect(page.getByText("You're already on Pro")).toBeVisible();
  });

  test('a subscriber whose paid period has ended is offered Pro again (the server already treats them as free)', async ({ context, page }) => {
    await backend(context, { profile: 'lapsed' });
    await openLoaded(page, '/pro');
    await expect(page.getByRole('button', { name: /Monthly/ })).toBeVisible();
    await expect(page.getByText("You're already on Pro")).toHaveCount(0);
  });

  test('after paying, the page picks up Pro instead of offering the plans again', async ({ context, page }) => {
    const state = await backend(context);
    await page.goto('/pro');
    await page.getByRole('button', { name: /Monthly/ }).click();
    await expect.poll(async () => (await paddle(page))?.checkouts.length).toBe(1);
    state.profile = PROFILES.pro; // the webhook has granted Pro
    await page.evaluate(() => window.__paddle.emit({ name: 'checkout.completed', data: { status: 'completed' } }));
    await expect(page.getByText("You're already on Pro")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Settings: subscription section', () => {
  test('a Pro user sees their status and next billing date, and Manage opens Paddle', async ({ context, page }) => {
    await backend(context, { profile: 'pro' });
    await page.goto('/settings');
    await expect(page.getByText('Pro — active')).toBeVisible();
    await expect(page.getByText('Dec 1, 2026')).toBeVisible();
    await page.getByText('Manage Subscription').click();
    await expect.poll(() => page.evaluate(() => window.__opened)).toEqual([STATUS.active.manage_url]);
  });

  test('a scheduled cancellation shows when Pro ends', async ({ context, page }) => {
    await backend(context, { profile: 'cancelling', status: STATUS.cancelling });
    await page.goto('/settings');
    await expect(page.getByText('Cancels Dec 15, 2026')).toBeVisible();
  });

  test('a Pro user can cancel from the app', async ({ context, page }) => {
    await backend(context, { profile: 'pro' });
    await page.goto('/settings');
    await page.getByText('Cancel Subscription').click();
    await expect.poll(() => page.evaluate(() => window.__opened)).toEqual([STATUS.active.cancel_url]);
  });

  test('if the details cannot be loaded it says so, rather than inventing a date', async ({ context, page }) => {
    await backend(context, { profile: 'pro', statusCode: 500 });
    await page.goto('/settings');
    await expect(page.getByText("Couldn't load")).toBeVisible();
    await page.getByText('Manage Subscription').click();
    await expect(page.getByText('Could not load subscription management link')).toBeVisible();
  });

  test('a free user is offered the upgrade, which goes to the Pro page', async ({ context, page }) => {
    await backend(context);
    await page.goto('/settings');
    await page.getByText('Upgrade to Pro').click();
    await expect(page).toHaveURL(/\/pro$/);
  });
});

test.describe('Pro gates in the app', () => {
  test('free: Pro themes are locked and lead to the upgrade page', async ({ context, page }) => {
    const state = await backend(context);
    await page.goto('/settings');
    await page.getByRole('button', { name: /Cyberpunk.*Pro only/ }).click();
    await expect(page).toHaveURL(/\/pro$/);
    expect(state.themeWrites).toEqual([]);
  });

  test('Pro: Pro themes can be picked', async ({ context, page }) => {
    const state = await backend(context, { profile: 'pro' });
    await page.goto('/settings');
    await page.getByRole('button', { name: /Use Cyberpunk theme/ }).click();
    await expect.poll(() => state.themeWrites.some((w) => w.theme === 'cyberpunk')).toBe(true);
  });

  test('free at 5 crates: creating another needs Pro', async ({ context, page }) => {
    await backend(context, { crates: 5 });
    await openLoaded(page, '/crates');
    await expect(page.getByText('Upgrade to create unlimited crates')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Crate' })).toHaveCount(0);
  });

  test('Pro at 5 crates: no limit', async ({ context, page }) => {
    await backend(context, { profile: 'pro', crates: 5 });
    await page.goto('/crates');
    await expect(page.getByRole('button', { name: /New Crate/ })).toBeVisible();
    await expect(page.getByText('Upgrade to create unlimited crates')).toHaveCount(0);
  });
});
