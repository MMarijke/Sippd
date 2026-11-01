import { initializePaddle } from '@paddle/paddle-js';

let paddleInstance = null;
// Tracks which customer the cached instance was initialized for, so a
// second call with a different (or newly-known) paddleCustomerId
// re-initializes instead of silently reusing a stale pwCustomer. In
// practice the only call site (Pro.jsx, gated to non-Pro users) almost
// always passes undefined here — pwCustomer mainly matters for a returning
// customer who cancelled and is resubscribing, so Paddle links the new
// checkout back to their existing Paddle customer record instead of
// creating a duplicate. A plain page reload also resets this singleton and
// picks up the current value fresh, so no invalidation logic beyond this
// check is needed for the one place that calls it today.
let paddleInstanceCustomerId;

// Checkout events (checkout.completed, checkout.closed, ...) for whoever is
// listening, e.g. Pro.jsx waiting for a payment to turn into Pro. Paddle
// takes one eventCallback per initialization, so it fans out from here.
const listeners = new Set();
export function onPaddleEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getPaddle(paddleCustomerId) {
  if (paddleInstance && paddleInstanceCustomerId === paddleCustomerId) return paddleInstance;

  const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT;
  if (!environment) {
    // No fallback on purpose — a missing env var silently defaulting to
    // "sandbox" is exactly the kind of bug that stays invisible until a
    // real customer hits it in production.
    throw new Error(
      'VITE_PADDLE_ENVIRONMENT is not set. Set it explicitly to "sandbox" or "production" for this deploy.'
    );
  }

  paddleInstance = await initializePaddle({
    environment,
    token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN,
    eventCallback: (event) => listeners.forEach((listener) => listener(event)),
    // Paddle Retain: identifies a returning customer by their real Paddle
    // customer ID (profiles.paddle_customer_id, set by paddle-webhook on
    // subscription.activated) — never Sippd's own user id or email, which
    // Paddle wouldn't be able to match to anything. Omitted entirely for a
    // customer Paddle has never seen yet (paddleCustomerId undefined).
    ...(paddleCustomerId ? { pwCustomer: { id: paddleCustomerId } } : {}),
  });
  paddleInstanceCustomerId = paddleCustomerId;
  return paddleInstance;
}

export async function openCheckout(priceId, user, paddleCustomerId) {
  const paddle = await getPaddle(paddleCustomerId);
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: { email: user.email },
    // paddle-webhook resolves the Sippd user via custom_data.user_id on
    // subscription.activated — see supabase/functions/paddle-webhook/index.ts.
    customData: { user_id: user.id },
  });
}

export const PADDLE_MONTHLY_PRICE_ID = import.meta.env.VITE_PADDLE_MONTHLY_PRICE_ID;
export const PADDLE_ANNUAL_PRICE_ID = import.meta.env.VITE_PADDLE_ANNUAL_PRICE_ID;
