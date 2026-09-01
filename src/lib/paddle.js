import { initializePaddle } from '@paddle/paddle-js';

let paddleInstance = null;

export async function getPaddle() {
  if (paddleInstance) return paddleInstance;

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
  });
  return paddleInstance;
}

export async function openCheckout(priceId, user) {
  const paddle = await getPaddle();
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
