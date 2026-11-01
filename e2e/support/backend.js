// A signed-in session and a faked Supabase + Paddle.js for e2e specs.
// Nothing here reaches a real server: every Supabase and Paddle request is
// answered in the test (context.route also covers service-worker fetches).

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const farFuture = () => Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;

export async function signIn(context, { userId, email }) {
  await context.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    {
      key: 'sb-e2e-placeholder-auth-token',
      session: {
        access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: farFuture() })}.fake`,
        token_type: 'bearer',
        expires_in: 60 * 60 * 24 * 365,
        expires_at: farFuture(),
        refresh_token: 'fake-refresh-token',
        user: { id: userId, aud: 'authenticated', role: 'authenticated', email, created_at: '2026-01-01T00:00:00Z' },
      },
    }
  );
}

// PostgREST answers an object for .single()/.maybeSingle() (Accept:
// application/vnd.pgrst.object+json) and an array otherwise.
export function rest(route, rows) {
  const wantsObject = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
  return route.fulfill({ json: wantsObject ? rows[0] ?? null : rows });
}

// A stand-in for https://cdn.paddle.com/paddle/v2/paddle.js. Records what
// the app asks Paddle to do in window.__paddle, and lets a test fire
// checkout events the way the real overlay would.
export const FAKE_PADDLE_JS = `
  window.__paddle = { environment: null, init: null, checkouts: [] };
  window.PaddleBillingV1 = {
    Initialized: false,
    Environment: { set(env) { window.__paddle.environment = env; } },
    Initialize(options) { window.__paddle.init = options; this.Initialized = true; },
    Update(options) { window.__paddle.init = { ...window.__paddle.init, ...options }; },
    Checkout: {
      open(options) { window.__paddle.checkouts.push(options); },
      close() {},
    },
  };
  window.__paddle.emit = (event) => window.__paddle.init?.eventCallback?.(event);
`;
