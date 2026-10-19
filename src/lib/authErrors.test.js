import { describe, expect, it } from 'vitest';
import { describeAuthError, validateAuthForm, signUpNeedsConfirmation, MIN_PASSWORD } from './authErrors';

const authError = (props) => Object.assign(new Error(props.message || 'x'), props);

describe('validateAuthForm', () => {
  const ok = { email: 'collector@example.com', password: 'secret-pass', confirmPassword: 'secret-pass' };

  it('passes a complete sign-up', () => {
    expect(validateAuthForm('signup', ok)).toEqual([]);
  });

  it('marks every problem at once, in field order', () => {
    const problems = validateAuthForm('signup', { email: '', password: '123', confirmPassword: '' });
    expect(problems.map((p) => [p.field, p.key])).toEqual([
      ['email', 'emailMissing'],
      ['password', 'passwordShort'],
      ['confirm', 'confirmMissing'],
    ]);
  });

  it('catches a mismatched confirmation on the confirm field', () => {
    const [p] = validateAuthForm('signup', { ...ok, confirmPassword: 'other-pass' });
    expect(p.field).toBe('confirm');
    expect(p.key).toBe('confirmMismatch');
  });

  it('checks the email shape, ignoring surrounding spaces', () => {
    expect(validateAuthForm('forgot', { email: 'not-an-email' })[0].key).toBe('emailInvalid');
    expect(validateAuthForm('forgot', { email: '  collector@example.com ' })).toEqual([]);
  });

  it('only asks for the minimum length when creating a password', () => {
    expect(validateAuthForm('signin', { email: ok.email, password: '123' })).toEqual([]);
    expect(validateAuthForm('signup', { ...ok, password: 'a'.repeat(MIN_PASSWORD - 1), confirmPassword: 'a'.repeat(MIN_PASSWORD - 1) })[0].key).toBe('passwordShort');
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

  it('offers a reset for wrong credentials, without blaming one field', () => {
    expect(describeAuthError(authError({ code: 'invalid_credentials' }))).toMatchObject({ field: null, action: 'forgot' });
    expect(describeAuthError(authError({ message: 'Invalid login credentials' })).key).toBe('wrongCredentials');
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
