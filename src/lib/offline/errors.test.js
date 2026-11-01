import { describe, expect, it } from 'vitest';
import { classifyError } from './errors';

describe('classifyError: server limits become actionable messages', () => {
  it('a pin past the cap (enforce_pin_limit) is a limit, not a retry', () => {
    const { kind, message } = classifyError(new Error('pin_limit_reached'));
    expect(kind).toBe('limit');
    expect(message).toMatch(/Unpin a can/);
  });

  it('the daily scan cap is a limit', () => {
    expect(classifyError({ message: 'daily_scan_limit_reached' }).kind).toBe('limit');
  });

  it('network failures and 5xx are retried; other rejections are fatal', () => {
    expect(classifyError(new TypeError('Failed to fetch')).kind).toBe('retry');
    expect(classifyError({ message: 'oops', status: 503 }).kind).toBe('retry');
    expect(classifyError({ message: 'new row violates row-level security policy', status: 403 }).kind).toBe('fatal');
  });
});
