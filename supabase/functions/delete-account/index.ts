// Deletes the calling user's own account, permanently.
//
// The user id is ALWAYS derived from the caller's own verified JWT — never
// from a client-supplied value — so this function can only ever delete the
// account making the request. auth.admin.deleteUser() removes the
// auth.users row; every table in the schema cascades from there via
// `references profiles (id) on delete cascade` (see
// supabase/migrations/20260815120000_initial_schema.sql and
// 20260821000000_account_deletion_support.sql for the two aggregate-count
// decrement triggers that keep shared_cans in sync).
//
// Before deleting, cancels any active Paddle subscription on file. Deletion
// alone only removed profiles.paddle_subscription_id along with the rest of
// the row — it never told Paddle to stop billing, so a Pro user who deleted
// their account kept getting charged with no Sippd account left to see or
// cancel it from. If the Paddle cancel call fails, deletion is aborted
// rather than deleting the account out from under a subscription that's
// still active — the user can retry, and worst case they're left with an
// intact account rather than a deleted one still silently billing them.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically into every deployed Edge Function by the platform
// — no secrets to set manually for this one. PADDLE_API_KEY and
// PADDLE_API_ENVIRONMENT are the same ones get-subscription-status uses.
//
// Sentry + rate limiting were both missing here despite being present on
// the other edge functions that need them — this is a destructive,
// security-sensitive endpoint (permanently deletes an account and cancels
// live billing) that had zero monitoring or throttling. (/impeccable critique)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Ratelimit } from 'npm:@upstash/ratelimit@2.0.8';
import { Redis } from 'npm:@upstash/redis@1.38.3';
import { initSentry, captureException } from '../_shared/sentry.ts';

initSentry('delete-account');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PADDLE_API_KEY = Deno.env.get('PADDLE_API_KEY')!;
const PADDLE_API_ENVIRONMENT = Deno.env.get('PADDLE_API_ENVIRONMENT');
if (!PADDLE_API_ENVIRONMENT) {
  // Fail loudly rather than silently guessing sandbox/live — matches
  // get-subscription-status's own guard for the same env var.
  throw new Error('PADDLE_API_ENVIRONMENT is not set. Set it to "sandbox" or "production".');
}
const PADDLE_API_BASE = PADDLE_API_ENVIRONMENT === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
});
// Tighter than get-subscription-status's 30/hour (a read) — this is a
// destructive action nobody legitimately calls often, but still generous
// enough to allow a retry after a transient Paddle-cancel failure.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: false,
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Cancels the given subscription immediately. No-ops if it's already
// canceled (e.g. previously canceled via Paddle's own customer portal).
// Throws on any other Paddle API failure so the caller aborts deletion
// instead of proceeding as if billing had actually been stopped.
async function cancelPaddleSubscription(subscriptionId: string) {
  const getRes = await fetch(`${PADDLE_API_BASE}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
  });
  const getBody = await getRes.json();
  if (!getRes.ok) {
    throw new Error(`Paddle API error fetching subscription ${getRes.status}: ${JSON.stringify(getBody.error ?? getBody)}`);
  }
  if (getBody.data?.status === 'canceled') {
    return;
  }

  const cancelRes = await fetch(`${PADDLE_API_BASE}/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ effective_from: 'immediately' }),
  });
  if (!cancelRes.ok) {
    const cancelBody = await cancelRes.json().catch(() => ({}));
    throw new Error(`Paddle API error canceling subscription ${cancelRes.status}: ${JSON.stringify(cancelBody.error ?? cancelBody)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  try {
    // Scoped to the caller's own JWT — used only to identify who's asking.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const { success } = await ratelimit.limit(user.id);
    if (!success) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429);
    }

    const { data: profile, error: profileError } = await callerClient
      .from('profiles')
      .select('paddle_subscription_id')
      .eq('id', user.id)
      .single();
    if (profileError) {
      console.error('delete-account: failed to read profile', profileError);
      return jsonResponse({ error: 'Failed to look up subscription' }, 500);
    }

    if (profile?.paddle_subscription_id) {
      try {
        await cancelPaddleSubscription(profile.paddle_subscription_id);
      } catch (err) {
        console.error('delete-account: failed to cancel Paddle subscription', err);
        await captureException(err, { where: 'cancelPaddleSubscription' });
        return jsonResponse({ error: 'Failed to cancel your subscription — please try again, or contact support if this persists.' }, 502);
      }
    }

    // service_role — only ever used here, only ever to delete the exact uid
    // resolved above from the caller's own token.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('delete-account: auth.admin.deleteUser failed', deleteError);
      return jsonResponse({ error: 'Failed to delete account' }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('delete-account: unexpected error', err);
    await captureException(err, { where: 'top-level handler' });
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});
