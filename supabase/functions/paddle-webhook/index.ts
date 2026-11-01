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

// IP allowlist, defense-in-depth on top of signature verification below —
// Paddle's own guidance is to allowlist their webhook IPs rather than trust
// signature checking alone. The list is never hardcoded (Paddle can change
// it); instead it's fetched from Paddle's own source-of-truth endpoint and
// cached in memory for an hour so a burst of webhook deliveries against a
// warm instance doesn't refetch on every single request.
const PADDLE_IPS_ENDPOINT = "https://api.paddle.com/ips";
const IP_CACHE_TTL_MS = 60 * 60 * 1000;
let cachedCidrs: string[] | null = null;
let cachedAt = 0;

async function getAllowedCidrs(): Promise<string[]> {
  const isStale = Date.now() - cachedAt > IP_CACHE_TTL_MS;
  if (cachedCidrs && !isStale) return cachedCidrs;

  try {
    const res = await fetch(PADDLE_IPS_ENDPOINT);
    if (!res.ok) throw new Error(`Paddle IPs endpoint returned ${res.status}`);
    const body = await res.json();
    const cidrs = body?.data?.ipv4_cidrs as string[] | undefined;
    if (!Array.isArray(cidrs) || cidrs.length === 0) {
      throw new Error("Paddle IPs endpoint returned no ipv4_cidrs");
    }
    cachedCidrs = cidrs;
    cachedAt = Date.now();
    return cachedCidrs;
  } catch (err) {
    // Keep serving the last known-good list rather than failing every
    // webhook over a transient fetch hiccup against Paddle's own endpoint.
    // Only truly fail closed (empty list -> every IP rejected below) if we
    // have never successfully fetched it at all, e.g. a fresh cold start
    // whose very first outbound fetch failed.
    console.error("paddle-webhook: failed to refresh Paddle IP allowlist", err);
    await captureException(err instanceof Error ? err : new Error(String(err)), {
      where: "getAllowedCidrs",
    });
    return cachedCidrs ?? [];
  }
}

function ipToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  const ipNum = ipToUint32(ip);
  const rangeNum = ipToUint32(rangeIp);
  if (ipNum === null || rangeNum === null || !Number.isInteger(prefix)) return false;
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

async function isAllowedPaddleIp(ip: string): Promise<boolean> {
  if (ip === "unknown") return false;
  const cidrs = await getAllowedCidrs();
  return cidrs.some((cidr) => ipInCidr(ip, cidr));
}

// How old a signature may be. Paddle signs each delivery attempt with the
// time it was sent, so a legitimate one is seconds old; 5 minutes leaves
// room for clock skew and queueing. Older ones are refused even with a
// valid hash, so a captured request can't be replayed later (the
// paddle_events duplicate check below is the second line of defence).
const SIGNATURE_MAX_AGE_SECONDS = 300;

function verifySignature(rawBody: string, header: string): boolean {
  // header format: "ts=<timestamp>;h1=<hash>", with more than one h1 while
  // a webhook secret is being rotated (any match is accepted).
  let ts = "";
  const hashes: string[] = [];
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (key === "ts") ts = value;
    else if (key === "h1" && value) hashes.push(value);
  }
  if (!/^\d+$/.test(ts) || hashes.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (age > SIGNATURE_MAX_AGE_SECONDS) return false;

  const signedPayload = `${ts}:${rawBody}`;
  const expectedBuf = Buffer.from(createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex"));

  return hashes.some((h) => {
    const actualBuf = Buffer.from(h);
    return actualBuf.length === expectedBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  });
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

// A problem retrying can't fix (the same payload would fail the same way):
// reported to Sentry, left unprocessed in paddle_events for a manual look,
// and acknowledged with 200 so Paddle stops redelivering it. Anything else
// thrown while processing is treated as transient and answered with a 500,
// so Paddle redelivers it later.
class PermanentEventError extends Error {}

// Paddle doesn't guarantee delivery order, and a canceled subscription never
// becomes active again (resubscribing creates a new subscription id). So an
// activated/updated event for the very subscription this profile already
// has as cancelled is a late delivery, and must not grant Pro back.
function isStaleForCancelled(profile: { paddle_subscription_id: unknown; subscription_status: unknown }, subscriptionId: unknown) {
  return profile.paddle_subscription_id === subscriptionId && profile.subscription_status === "cancelled";
}

async function applySubscriptionActivated(data: Record<string, unknown>) {
  const userId = resolveUserIdFromCheckout(data);
  if (!userId) {
    // A paying customer we can't match to an account: never only a log line.
    throw new PermanentEventError(`no custom_data.user_id on subscription.activated (${data.id})`);
  }

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("paddle_subscription_id, subscription_status")
    .eq("id", userId)
    .single();
  if (readError) throw readError;
  if (isStaleForCancelled(current, data.id)) {
    console.warn(`paddle-webhook: ignoring late subscription.activated for already-cancelled ${data.id}`);
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

  const { data: owners, error: readError } = await supabase
    .from("profiles")
    .select("id, paddle_subscription_id, subscription_status")
    .eq("paddle_subscription_id", subscriptionId);
  if (readError) throw readError;
  if (!owners || owners.length === 0) {
    // Most likely delivered before its subscription.activated: thrown as
    // transient, so Paddle redelivers it once activated has stored the id.
    throw new Error(`no profile with paddle_subscription_id on subscription.updated (${subscriptionId})`);
  }
  if (owners.every((p: { paddle_subscription_id: unknown; subscription_status: unknown }) => isStaleForCancelled(p, subscriptionId))) {
    console.warn(`paddle-webhook: ignoring late subscription.updated for already-cancelled ${subscriptionId}`);
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("paddle_subscription_id", subscriptionId);

  if (error) throw error;
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
    // Same as subscription.updated: most likely ahead of its activated.
    throw new Error(`no profile with paddle_subscription_id on subscription.canceled (${subscriptionId})`);
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
    // Same client-IP extraction as image-proxy's rate limiter: first hop of
    // x-forwarded-for, falling back to x-real-ip.
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = (forwardedFor ? forwardedFor.split(",")[0].trim() : null)
      ?? req.headers.get("x-real-ip")
      ?? "unknown";

    if (!(await isAllowedPaddleIp(clientIp))) {
      console.error(`paddle-webhook: rejected request from non-Paddle IP ${clientIp}`);
      return new Response("Forbidden", { status: 403 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature") ?? "";

    if (!verifySignature(rawBody, signature)) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Log first (the audit trail and the idempotency key: event_id is
    // unique), then process. Processing is one or two single-row queries,
    // well inside Paddle's 5-second limit, and is done before answering so
    // a failure can answer non-2xx: Paddle then redelivers the event, and
    // the redelivery picks up an event that was logged but never processed.
    const { error: insertError } = await supabase
      .from("paddle_events")
      .insert({ event_id: event.event_id, event_type: event.event_type, payload: event });

    if (insertError) {
      if (insertError.code !== "23505") {
        // Not stored, so not processed either: ask Paddle to try again
        // rather than acknowledge an event we've lost.
        console.error("paddle-webhook: failed to log event", insertError);
        await captureException(new Error(`paddle-webhook: failed to log event: ${insertError.message}`), {
          eventType: event.event_type,
          eventId: event.event_id,
        });
        return new Response("Could not store event", { status: 500 });
      }
      const { data: seen, error: seenError } = await supabase
        .from("paddle_events")
        .select("processed")
        .eq("event_id", event.event_id)
        .single();
      if (seenError) throw seenError;
      if (seen.processed) return new Response("OK (duplicate)", { status: 200 });
      // Logged by an earlier delivery whose processing failed: retry it now.
    }

    try {
      await processEvent(event);
    } catch (err) {
      console.error("paddle-webhook: failed to process event", event.event_id, err);
      await captureException(err, {
        eventType: event.event_type,
        eventId: event.event_id,
        objectId: (event.data as Record<string, unknown> | undefined)?.id,
      });
      return err instanceof PermanentEventError
        ? new Response("OK (unprocessable, not retrying)", { status: 200 })
        : new Response("Processing failed", { status: 500 });
    }

    const { error: markError } = await supabase
      .from("paddle_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("event_id", event.event_id);
    // The profile is already updated; a redelivery would just reapply the
    // same change. Worth knowing about, not worth a retry.
    if (markError) await captureException(new Error(`paddle-webhook: failed to mark processed: ${markError.message}`), { eventId: event.event_id });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("paddle-webhook: unhandled error", err);
    await captureException(err, { where: "top-level handler" });
    return new Response("Internal error", { status: 500 });
  }
});
