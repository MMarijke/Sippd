import { test, expect } from '@playwright/test';

// Two boot-level smoke tests, not integration coverage — RLS/RPC behavior
// is covered by supabase/tests/*.sql, and business logic by Vitest under
// src/. This suite only asks "does the built app actually mount and render
// real content," which is the one thing neither of those can catch (a
// blank white screen from a routing/build/provider-nesting mistake would
// still pass every unit test).
//
// Every Supabase call the authenticated path makes is intercepted below —
// this never reaches the linked project or any real backend, and needs no
// real credentials (see playwright.config.js's webServer.env).

const FAKE_USER_ID = '11111111-1111-1111-1111-111111111111';

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// Not a real signed JWT (no valid signature) — supabase-js's getSession()
// reads a locally-stored session from storage without verifying the
// signature client-side; verification only happens if this token is ever
// sent to a real server, which the route mocks below prevent entirely.
function fakeAccessToken(userId) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  });
  return `${header}.${payload}.fake-signature`;
}

async function mockLoggedInSession(page) {
  const fakeSession = {
    access_token: fakeAccessToken(FAKE_USER_ID),
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    refresh_token: 'fake-refresh-token',
    user: {
      id: FAKE_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e-smoke@sippd.test',
      created_at: '2026-01-01T00:00:00Z',
    },
  };

  // supabase-js v2's default storage key: sb-<project-ref>-auth-token,
  // where <project-ref> is the first label of VITE_SUPABASE_URL's
  // hostname. Must be seeded via addInitScript (runs before any page
  // script) — setting it after goto() would be too late, since useAuth's
  // getSession() call fires on the very first render.
  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    { key: 'sb-e2e-placeholder-auth-token', session: fakeSession }
  );

  // Blanket-mock every PostgREST call (plain table selects AND RPC calls,
  // both served under /rest/v1/) with an empty result. Every query this
  // app's initial authenticated render depends on (profiles, user_collection,
  // shared_cans, rarity_votes, notifications, tick_streak) degrades to an
  // empty/zero state on no data — none of them throw or block rendering,
  // by design (see Home.jsx/useStreak.js) — so one blanket response is
  // enough for a boot-level smoke test without hand-shaping each endpoint.
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
}

test('an unauthenticated visitor is redirected to /login and sees real content', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  // The form's Sign up | Sign in tabs: real, rendered content at every
  // viewport. (The opening's corner "Sign in" button is phone-only now, so
  // at this Desktop Chrome size it's hidden and can't be what we assert.)
  await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sign up' })).toHaveAttribute('aria-selected', 'true');
});

test('a logged-in user lands on Home and the dashboard renders', async ({ page }) => {
  await mockLoggedInSession(page);

  await page.goto('/');

  await expect(page).toHaveURL('/');
  // PageHeader's title on Home — real, static, theme/data-independent text.
  // Only resolves once ProtectedRoute's own loading state has settled and
  // it rendered <Outlet/> (Home) instead of redirecting to /login.
  await expect(page.getByRole('heading', { name: 'SIPPD' })).toBeVisible();
});
