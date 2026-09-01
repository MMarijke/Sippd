// Paddle Billing webhook handler for Sippd Pro subscriptions.
//
// Sippd has no team/group concept — subscriptions are per-user, one
// profiles row per subscription, no group-membership fan-out.
//
// User resolution is two-tier by event:
//  - subscription.activated: resolves via custom_data.user_id, stamped by
//    the checkout flow (PRO-3) at Paddle.Checkout.open() time. This is the
//    only event allowed to depend on custom_data — it's the one point where
//    Sippd's own user id hasn't been persisted onto the subscription yet.
//  - subscription.updated / subscription.canceled: resolve by matching
//    profiles.paddle_subscription_id = data.id directly in the UPDATE's
//    WHERE clause. By the time either fires, paddle_subscription_id was
//    already written by the activated event (Paddle's own docs: updated
//    "typically follows" activated for the same lifecycle transition), so
//    this doesn't depend on custom_data propagating to every event type —
//    only the first one.
//
// Grace-period note: the "keeps Pro access until end of billing period"
// behavior is applied on subscription.updated, not subscription.canceled.
// Paddle's docs confirm scheduled_change is null by the time
// subscription.canceled fires — it's only populated on the prior
// subscription.updated event, while status is still "active". So this
// function keeps subscription_status = 'pro' with pro_expires_at set to the
// scheduled cancellation date on that updated event (is_pro() only reads
// pro_expires_at while status = 'pro' — see 20260901000000_add_pro_subscription.sql),
// and only flips to 'cancelled' once subscription.canceled actually fires.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { initSentry, captureException } from "../_shared/sentry.ts";

initSentry("paddle-webhook");

const WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function verifySignature(rawBody: string, header: string): boolean {
  // header format: "ts=<timestamp>;h1=<hash>"
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=")));
  if (!parts.ts || !parts.h1) return false;

  const signedPayload = `${parts.ts}:${rawBody}`;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(parts.h1);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

// Only for subscription.activated — see the file-header note on why the
// other two events resolve by paddle_subscription_id instead.
function resolveUserIdFromCheckout(data: Record<string, unknown>): string | undefined {
  const customData = data.custom_data as Record<string, unknown> | null;
  return customData?.user_id as string | undefined;
}

// Only meaningful while status is still "active" — this is what carries the
// scheduled cancellation date before subscription.canceled fires and clears it.
function scheduledCancelEffectiveAt(data: Record<string, unknown>): string | null {
  const scheduled = data.scheduled_change as Record<string, unknown> | null;
  if (!scheduled || scheduled.action !== "cancel") return null;
  return (scheduled.effective_at as string | undefined) ?? null;
}

async function applySubscriptionActivated(data: Record<string, unknown>) {
  const userId = resolveUserIdFromCheckout(data);
  if (!userId) {
    console.error(`paddle-webhook: no custom_data.user_id on subscription.activated (${data.id})`);
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_status: "pro",
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customer_id,
      pro_expires_at: null,
    })
    .eq("id", userId);

  if (error) throw error;
}

// paddle_subscription_id is the join key here (see file header) — the WHERE
// clause resolves the user, not custom_data. subscription_status only moves
// to 'pro' while status is active/trialing (trialing counts as full access,
// per your call). past_due/paused/etc. are left alone rather than guessed
// at — not a grant, not a cancellation, and subscription.canceled owns that
// transition on its own.
async function applySubscriptionUpdated(data: Record<string, unknown>) {
  const subscriptionId = data.id as string;
  const status = data.status as string;

  const patch: Record<string, unknown> = {
    paddle_subscription_id: subscriptionId,
  };

  if (status === "active" || status === "trialing") {
    patch.subscription_status = "pro";
    // A scheduled cancellation keeps the user on 'pro' but records when
    // access actually ends. No scheduled change (null) clears any stale
    // expiry left over from a cancellation that was since reversed.
    patch.pro_expires_at = scheduledCancelEffectiveAt(data);
  }

  const { data: matched, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("paddle_subscription_id", subscriptionId)
    .select("id");

  if (error) throw error;
  if (!matched || matched.length === 0) {
    console.error(`paddle-webhook: no profile with paddle_subscription_id on subscription.updated (${subscriptionId})`);
  }
}

async function applySubscriptionCanceled(data: Record<string, unknown>) {
  const subscriptionId = data.id as string;

  const { data: matched, error } = await supabase
    .from("profiles")
    .update({
      subscription_status: "cancelled",
      pro_expires_at: (data.canceled_at as string | undefined) ?? new Date().toISOString(),
    })
    .eq("paddle_subscription_id", subscriptionId)
    .select("id");

  if (error) throw error;
  if (!matched || matched.length === 0) {
    console.error(`paddle-webhook: no profile with paddle_subscription_id on subscription.canceled (${subscriptionId})`);
  }
}

async function processEvent(event: { event_type: string; data: Record<string, unknown> }) {
  if (event.event_type === "subscription.activated") {
    await applySubscriptionActivated(event.data);
  } else if (event.event_type === "subscription.updated") {
    await applySubscriptionUpdated(event.data);
  } else if (event.event_type === "subscription.canceled") {
    await applySubscriptionCanceled(event.data);
  }
  // Other subscription.*/customer.* events are logged to paddle_events for
  // the audit trail but don't need further handling yet.
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature") ?? "";

    if (!verifySignature(rawBody, signature)) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Write first, ack fast, process after — Paddle expects a response
    // within 5 seconds and retries on timeout/non-2xx. Idempotency is
    // enforced by the unique constraint on event_id.
    const { error: insertError } = await supabase
      .from("paddle_events")
      .insert({ event_id: event.event_id, event_type: event.event_type, payload: event });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response("OK (duplicate)", { status: 200 });
      }
      console.error("paddle-webhook: failed to log event", insertError);
      const logFailureCaptured = captureException(new Error(`paddle-webhook: failed to log event: ${insertError.message}`), {
        eventType: event.event_type,
        eventId: event.event_id,
      });
      // @ts-ignore -- EdgeRuntime is a platform global, not in the standard lib types.
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(logFailureCaptured);
      return new Response("OK (log failed, not retrying)", { status: 200 });
    }

    const processed = processEvent(event)
      .then(() =>
        supabase
          .from("paddle_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("event_id", event.event_id)
      )
      .catch(async (err) => {
        console.error("paddle-webhook: failed to process event", event.event_id, err);
        await captureException(err, {
          eventType: event.event_type,
          eventId: event.event_id,
          objectId: (event.data as Record<string, unknown> | undefined)?.id,
        });
      });

    // Supabase/Deno Deploy's background-task hook: lets us respond
    // immediately (Paddle's 5-second rule) while finishing the DB update after.
    // @ts-ignore -- EdgeRuntime is a platform global, not in the standard lib types.
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(processed);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("paddle-webhook: unhandled error", err);
    await captureException(err, { where: "top-level handler" });
    return new Response("Internal error", { status: 500 });
  }
});
