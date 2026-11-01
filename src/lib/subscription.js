// Whether a profiles row counts as Pro. The client copy of the database's
// is_pro() (20260901000000_add_pro_subscription.sql), kept identical so the
// UI never offers a perk the server will refuse, or hides one it allows:
// status 'pro' AND no expiry, or an expiry still in the future.
//
// pro_expires_at is set while status is still 'pro' when a cancellation is
// scheduled (paddle-webhook, subscription.updated): access lasts until then,
// and stops at that moment even if subscription.canceled arrives late.
export function isProStatus(row, now = Date.now()) {
  if (row?.subscription_status !== 'pro') return false;
  if (!row.pro_expires_at) return true;
  return Date.parse(row.pro_expires_at) > now;
}
