// Plain-language sign-up / sign-in errors for the Login form, from Supabase
// auth errors and from the form's own checks. Each says what went wrong and
// what to do next, names the field it belongs to (so the form can mark that
// field and tie the message to it), and, where there is one, offers the
// next step as an action:
//   field:  'email' | 'password' | null (about the whole form)
//   action: 'signin' | 'resend' | null
// Raw Supabase messages are never shown; an unknown error gets a generic
// "try again" rather than an internal string.

export const MIN_PASSWORD = 6; // Supabase Auth's default minimum length.

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MESSAGES = {
  emailMissing: { field: 'email', message: 'Enter your email address.' },
  emailInvalid: { field: 'email', message: "That doesn't look like an email address. Check it and try again." },
  passwordMissing: { field: 'password', message: 'Enter your password.' },
  passwordShort: { field: 'password', message: `Use at least ${MIN_PASSWORD} characters.` },
  alreadyRegistered: { field: 'email', message: 'There is already an account with this email.', action: 'signin' },
  // No action button: "Forgot password?" already sits right above the error.
  wrongCredentials: { field: null, message: "That email and password don't match an account. Check them and try again, or use Forgot password." },
  notConfirmed: { field: 'email', message: "You haven't confirmed this email yet. Open the link we sent you, or get a new one.", action: 'resend' },
  weakPassword: { field: 'password', message: 'Choose a stronger password: longer, and harder to guess.' },
  tooManyEmails: { field: null, message: "We've sent several emails to this address already. Wait a few minutes, then try again." },
  tooManyTries: { field: null, message: 'Too many attempts. Wait a minute, then try again.' },
  signupClosed: { field: null, message: "New sign-ups are paused right now. Try again later." },
  googleOff: { field: null, message: "Google sign-in isn't available right now. Use your email and a password instead." },
  googleCancelled: { field: null, message: 'Google sign-in was cancelled. Try again, or use your email instead.' },
  offline: { field: null, message: "Couldn't reach Sippd. Check your connection, then try again." },
  unknown: { field: null, message: 'Something went wrong on our side. Try again in a moment.' },
};

function result(key) {
  const { field, message, action = null } = MESSAGES[key];
  return { key, field, message, action };
}

// The form's own checks, run before anything is sent. Returns every
// problem, in field order, so the form can mark each field at once and
// focus the first.
// There's no confirm-password field: the form's show-password toggle lets
// people check what they typed instead of typing it twice.
export function validateAuthForm(mode, { email, password }) {
  const problems = [];
  const trimmed = (email || '').trim();
  if (!trimmed) problems.push(result('emailMissing'));
  else if (!EMAIL_SHAPE.test(trimmed)) problems.push(result('emailInvalid'));
  if (mode === 'forgot') return problems;

  if (!password) problems.push(result('passwordMissing'));
  else if (mode === 'signup' && password.length < MIN_PASSWORD) problems.push(result('passwordShort'));
  return problems;
}

// A Supabase auth error (from signUp, signInWithPassword, resend,
// resetPasswordForEmail) in plain words. Matches on error.code first, then
// on the older message strings some versions still return without a code.
export function describeAuthError(error) {
  if (!error) return null;
  const code = error.code || '';
  const msg = String(error.message || '').toLowerCase();
  const status = error.status;

  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) return result('alreadyRegistered');
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return result('wrongCredentials');
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return result('notConfirmed');
  if (code === 'weak_password') return result('weakPassword');
  if (code === 'email_address_invalid' || msg.includes('invalid format')) return result('emailInvalid');
  if (msg.includes('password should be at least')) return result('passwordShort');
  if (code === 'over_email_send_rate_limit') return result('tooManyEmails');
  if (code === 'over_request_rate_limit' || status === 429) return result('tooManyTries');
  if (code === 'signup_disabled') return result('signupClosed');
  // Google: switched off in Supabase (googleSignIn.js checks before
  // redirecting; the message is Supabase's own wording), or the user backed
  // out of Google's screen (OAuth's standard access_denied).
  if (code === 'google_disabled' || msg.includes('provider is not enabled')) return result('googleOff');
  if (code === 'access_denied') return result('googleCancelled');
  if (error.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network')) return result('offline');
  return result('unknown');
}

// Supabase, with email confirmation on, answers sign-up for an address that
// already has an account with a user that has no identities (and no error),
// so as not to reveal which emails are registered. The form treats that the
// same as a fresh sign-up: the "check your inbox" screen, which also offers
// "Already have an account? Sign in".
export function signUpNeedsConfirmation(data) {
  return !data?.session;
}
