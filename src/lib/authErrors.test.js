import { describe, expect, it } from 'vitest';
import { describeAuthError, validateAuthForm, signUpNeedsConfirmation, MIN_PASSWORD } from './authErrors';

const authError = (props) => Object.assign(new Error(props.message || 'x'), props);

describe('validateAuthForm', () => {
  const ok = { email: 'collector@example.com', password: 'secret-pass' };

  it('passes a complete sign-up', () => {
    expect(validateAuthForm('signup', ok)).toEqual([]);
  });

  it('marks every problem at once, in field order', () => {
    const problems = validateAuthForm('signup', { email: '', password: '123' });
    expect(problems.map((p) => [p.field, p.key])).toEqual([
      ['email', 'emailMissing'],
      ['password', 'passwordShort'],
    ]);
  });

  it('asks for the password once (no confirm field)', () => {
    expect(validateAuthForm('signup', { email: ok.email, password: '' }).map((p) => p.key)).toEqual(['passwordMissing']);
  });

  it('checks the email shape, ignoring surrounding spaces', () => {
    expect(validateAuthForm('forgot', { email: 'not-an-email' })[0].key).toBe('emailInvalid');
    expect(validateAuthForm('forgot', { email: '  collector@example.com ' })).toEqual([]);
  });

  it('only asks for the minimum length when creating a password', () => {
    expect(validateAuthForm('signin', { email: ok.email, password: '123' })).toEqual([]);
    expect(validateAuthForm('signup', { ...ok, password: 'a'.repeat(MIN_PASSWORD - 1) })[0].key).toBe('passwordShort');
  });

  it('needs only the email to send a reset link', () => {
    expect(validateAuthForm('forgot', { email: ok.email, password: '' })).toEqual([]);
  });
});

describe('describeAuthError', () => {
  it('offers sign-in for an email that already has an account', () => {
    for (const e of [authError({ code: 'user_already_exists' }), authError({ code: 'email_exists' }), authError({ message: 'User already registered' })]) {
      expect(describeAuthError(e)).toMatchObject({ field: 'email', action: 'signin' });
    }
  });

  it('points wrong credentials at Forgot password, without a second reset link or blaming one field', () => {
    const d = describeAuthError(authError({ code: 'invalid_credentials' }));
    expect(d).toMatchObject({ field: null, action: null });
    expect(d.message).toMatch(/forgot password/i);
    expect(describeAuthError(authError({ message: 'Invalid login credentials' })).key).toBe('wrongCredentials');
  });

  it('explains Google being switched off or cancelled, without raw provider text', () => {
    expect(describeAuthError(authError({ code: 'google_disabled' })).key).toBe('googleOff');
    const off = describeAuthError(authError({ message: 'Unsupported provider: provider is not enabled' }));
    expect(off.key).toBe('googleOff');
    expect(off.message).not.toMatch(/provider/i);
    expect(describeAuthError(authError({ code: 'access_denied', message: 'User cancelled' })).key).toBe('googleCancelled');
  });

  it('offers a new confirmation email when the address is unconfirmed', () => {
    expect(describeAuthError(authError({ code: 'email_not_confirmed' }))).toMatchObject({ action: 'resend' });
  });

  it('maps rate limits and network failures to a wait / retry', () => {
    expect(describeAuthError(authError({ code: 'over_email_send_rate_limit' })).key).toBe('tooManyEmails');
    expect(describeAuthError(authError({ status: 429 })).key).toBe('tooManyTries');
    expect(describeAuthError(authError({ name: 'AuthRetryableFetchError' })).key).toBe('offline');
    expect(describeAuthError(authError({ message: 'Failed to fetch' })).key).toBe('offline');
  });

  it('never shows a raw message for something it does not know', () => {
    const d = describeAuthError(authError({ message: 'Database error saving new user' }));
    expect(d.key).toBe('unknown');
    expect(d.message).not.toMatch(/database/i);
  });

  it('returns null for no error', () => {
    expect(describeAuthError(null)).toBeNull();
  });
});

describe('signUpNeedsConfirmation', () => {
  it('is true whenever sign-up returned no session', () => {
    expect(signUpNeedsConfirmation({ user: { identities: [] }, session: null })).toBe(true);
    expect(signUpNeedsConfirmation({ user: {}, session: { access_token: 't' } })).toBe(false);
  });
});
