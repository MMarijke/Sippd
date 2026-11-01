import { describe, expect, it } from 'vitest';
import { isProStatus } from './subscription';

const NOW = Date.parse('2026-11-01T12:00:00Z');

describe('isProStatus (mirrors the database is_pro())', () => {
  it('Pro with no expiry is Pro', () => {
    expect(isProStatus({ subscription_status: 'pro', pro_expires_at: null }, NOW)).toBe(true);
  });

  it('Pro with a scheduled cancellation stays Pro until it ends', () => {
    expect(isProStatus({ subscription_status: 'pro', pro_expires_at: '2026-11-15T00:00:00Z' }, NOW)).toBe(true);
  });

  it('stops at the expiry, even before the subscription is marked cancelled', () => {
    expect(isProStatus({ subscription_status: 'pro', pro_expires_at: '2026-11-01T11:59:59Z' }, NOW)).toBe(false);
    expect(isProStatus({ subscription_status: 'pro', pro_expires_at: '2026-11-01T12:00:00Z' }, NOW)).toBe(false); // is_pro uses > now()
  });

  it('free, cancelled, and missing rows are not Pro', () => {
    expect(isProStatus({ subscription_status: 'free' }, NOW)).toBe(false);
    expect(isProStatus({ subscription_status: 'cancelled', pro_expires_at: '2099-01-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isProStatus(null, NOW)).toBe(false);
    expect(isProStatus(undefined, NOW)).toBe(false);
  });
});
