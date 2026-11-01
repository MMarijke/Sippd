// Backs Settings.jsx's Subscription section. JWT-verified — called by a
// signed-in user about their own subscription (contrast with paddle-webhook,
// which is service-role and Paddle-signature-verified instead, and never
// touched by a browser). Always hits Paddle's API live rather than trusting
// stored profiles columns for status/dates, since those only update when a
// webhook fires — this gives the Settings page a real-time view.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Ratelimit } from "npm:@upstash/ratelimit@2.0.8";
import { Redis } from "npm:@upstash/redis@1.38.3";
import { initSentry, captureException } from "../_shared/sentry.ts";

initSentry("get-subscription-status");

const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY")!;

const PADDLE_API_ENVIRONMENT = Deno.env.get("PADDLE_API_ENVIRONMENT");
if (PADDLE_API_ENVIRONMENT !== "sandbox" && PADDLE_API_ENVIRONMENT !== "production") {
  // Fail loudly rather than silently guessing sandbox/live — a wrong guess
  // here doesn't error obviously, it just quietly hits the wrong Paddle
  // account. Any other value (unset, "live", "prod") is a typo, not sandbox.
  throw new Error(`PADDLE_API_ENVIRONMENT must be "sandbox" or "production" (got ${JSON.stringify(PADDLE_API_ENVIRONMENT ?? null)}).`);
}
const PADDLE_API_BASE = PADDLE_API_ENVIRONMENT === "production"
  ? "https://api.paddle.com"
  : "https://sandbox-api.paddle.com";

const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});
// The Settings page can legitimately call this more than once per visit
// (React Query refetch-on-focus, etc.) — generous per-user cap, just enough
// to stop a runaway loop from hammering Paddle's live API.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: false,
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  try {
    // Scoped to the caller's own JWT, matching delete-account's pattern —
    // RLS (profiles: select own row only) is what actually restricts the
    // read below, no service role needed for a user reading their own data.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    const { success } = await ratelimit.limit(user.id);
    if (!success) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }

    const { data: profile, error: profileError } = await callerClient
      .from("profiles")
      .select("paddle_subscription_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.paddle_subscription_id) {
      return jsonResponse({ error: "No subscription on file" }, 404);
    }

    const res = await fetch(`${PADDLE_API_BASE}/subscriptions/${profile.paddle_subscription_id}`, {
      headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(`Paddle API error ${res.status}: ${JSON.stringify(body.error ?? body)}`);
    }
    const subscription = body.data;

    return jsonResponse({
      status: subscription.status,
      next_billing_date: subscription.next_billed_at,
      cancel_at: subscription.scheduled_change?.action === "cancel" ? subscription.scheduled_change.effective_at : null,
      manage_url: subscription.management_urls?.update_payment_method ?? null,
      // Paddle's own cancellation page for this subscription, so a user can
      // cancel from Settings (manage_url only updates the card).
      cancel_url: subscription.management_urls?.cancel ?? null,
    });
  } catch (err) {
    console.error("get-subscription-status: unexpected error", err);
    await captureException(err, { where: "top-level handler" });
    return jsonResponse({ error: "Failed to fetch subscription status" }, 500);
  }
});
