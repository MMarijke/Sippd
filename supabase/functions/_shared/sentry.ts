// Centralized Sentry setup for Deno edge functions. Every function routes
// error capture through here rather than calling Sentry.init/captureException
// directly — this is the one place scrubbing is enforced, so a function
// can't accidentally forward a caller's JWT, a full Paddle webhook payload,
// or a raw email address just by capturing an exception the normal way.
//
// Pinned to the same version as the frontend's @sentry/react (10.72.0) —
// both are the same Sentry JS SDK release train, just different platform
// entry points, so keeping them in lockstep avoids API drift between them.
import * as Sentry from "npm:@sentry/deno@10.72.0";

let initialized = false;

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "apikey",
  "cookie",
  "paddle-signature",
]);

function scrubHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return headers;
  const scrubbed: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    scrubbed[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return scrubbed;
}

// Backstop over free-text (error messages, extra context) in case an email
// slips in outside the structured fields already stripped below.
const EMAIL_PATTERN = /[^\s"'<>]+@[^\s"'<>]+\.[^\s"'<>]+/g;

function scrubEmailsInString(value: string): string {
  return value.replace(EMAIL_PATTERN, "[email redacted]");
}

/**
 * Initializes Sentry for one edge function. No-ops if SENTRY_DSN isn't set
 * yet, so functions keep working normally without it.
 */
export function initSentry(functionName: string) {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    // Every function calls captureException() manually from its own catch
    // block — DenoServe's auto request capture and RequestData's readback
    // buy nothing here and are one more surface that could carry request/IP
    // data, so both integrations are removed outright rather than trusted
    // to stay gated by dataCollection above.
    integrations: (defaults) => defaults.filter((i) => i.name !== "DenoServe" && i.name !== "RequestData"),
    skipOpenTelemetrySetup: true,
    beforeSend(event) {
      if (event.request) {
        event.request.headers = scrubHeaders(event.request.headers as Record<string, string> | undefined);
        delete event.request.data;
        delete event.request.cookies;
      }
      delete event.user;
      if (event.message) event.message = scrubEmailsInString(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrubEmailsInString(ex.value);
      }
      if (event.extra) {
        for (const [key, value] of Object.entries(event.extra)) {
          if (typeof value === "string") event.extra[key] = scrubEmailsInString(value);
        }
      }
      return event;
    },
  });

  Sentry.setTag("function", functionName);
  initialized = true;
}

/**
 * Captures an exception and flushes before the caller returns its response —
 * the edge runtime can freeze/terminate the isolate right after the response
 * is sent, which would otherwise drop the event before it uploads.
 *
 * `context` must only ever carry IDs/event types — never full objects
 * (webhook payloads, request bodies, user records).
 */
export async function captureException(err: unknown, context?: Record<string, unknown>) {
  if (context) Sentry.setContext("edge_function", context);
  Sentry.captureException(err);
  await Sentry.flush(2000);
}
