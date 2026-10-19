import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Eye, EyeOff, Check, MailCheck } from 'lucide-react';
import LegalFooter from '@/components/legal/LegalFooter';
import { PILL, PILL_OUTLINE } from '@/components/login/pill';
import { describeAuthError, validateAuthForm, signUpNeedsConfirmation, MIN_PASSWORD } from '@/lib/authErrors';
import { cn } from '@/lib/utils';

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.99-3.11z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

// Every control here is 44px tall (h-11), and the small text-style links
// get a 44px tap area around their visible text, so the form is usable
// one-handed on a phone. Fields take a 2px focus ring, like the pills.
const FIELD = 'h-11 rounded-xl bg-secondary border-border font-body focus-visible:ring-2 aria-[invalid=true]:border-destructive';
const LINK = 'inline-flex items-center min-h-11 px-2 -mx-2 text-primary hover:underline underline-offset-2';
const LABEL = 'text-xs font-mono uppercase tracking-wider text-muted-foreground';

const HEADINGS = {
  signup: ['Start your vault', 'Free to join, free to collect.'],
  signin: ['Welcome back', 'Sign in to pick up where you left off.'],
  forgot: ['Reset your password', "Enter your email and we'll send you a reset link."],
  'sent-confirm': ['Check your inbox', null],
  'sent-reset': ['Check your inbox', null],
};

// Can't-resend window after sending a link, so a double tap doesn't run
// into Supabase's email rate limit.
const RESEND_COOLDOWN_MS = 30000;

// Icon + text, so an error isn't carried by colour alone (it can sit near a
// red main colour: Boss Fight, Crimson, Cherry Pop, Brick).
function ErrorLine({ id, children, alert = false }) {
  return (
    <p id={id} role={alert ? 'alert' : undefined} className="flex items-start gap-1.5 text-xs font-mono text-destructive">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// The sign-up / sign-in / reset form, used by both the web page and the
// Android app's Login screen. It owns its own state; the page drives it
// through the ref: open(mode) switches mode and puts the cursor in Email,
// for "Get Started" and the header's "Sign in".
//
// Errors are plain language (src/lib/authErrors.js) and belong to a field
// where they can: the field is marked aria-invalid, the message is tied to
// it with aria-describedby, and the cursor moves to the first one. Errors
// about the whole form (wrong password, offline) are announced as alerts.
// A switch between sign-up / sign-in / reset / "check your inbox" moves
// focus to the new heading, so a screen reader announces where you are.
//
// onSentChange(sent) tells the page when a confirmation or reset email has
// gone out ('confirm' | 'reset', or null once the user leaves that screen),
// so it can stop selling and point its buttons at the inbox screen.
const AuthPanel = forwardRef(function AuthPanel({ onSentChange }, ref) {
  // Defaults to 'signup': on the web, a visitor who reaches the form
  // without tapping a specific button came through the pitch above it.
  const [mode, setMode] = useState('signup'); // 'signup' | 'signin' | 'forgot' | 'sent-confirm' | 'sent-reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({}); // { email?, password?, confirm? } -> describeAuthError() result
  const [formError, setFormError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resend, setResend] = useState({ sending: false, sentAt: 0 });
  const [, forceTick] = useState(0);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const headingRef = useRef(null);
  const fieldRefs = { email: emailRef, password: passwordRef, confirm: confirmRef };
  const [focusRequest, setFocusRequest] = useState(null); // { target: 'email'|'password'|'confirm'|'heading' }

  const clearMessages = () => {
    setFieldErrors({});
    setFormError(null);
  };

  // Switch mode from inside the panel (links, error actions), then focus the
  // new heading (or a given field) once it has rendered.
  const switchMode = (next, focusTarget = 'heading') => {
    setMode(next);
    clearMessages();
    if (next === 'signin' || next === 'signup' || next === 'forgot') setResend({ sending: false, sentAt: 0 });
    if (next === 'forgot' || next === 'signup') {
      setPassword('');
      setConfirmPassword('');
    }
    setFocusRequest({ target: focusTarget });
  };

  useImperativeHandle(ref, () => ({
    open(nextMode) {
      // An email is on its way: "Get Started" / "Start your vault" must not
      // throw that screen away for an empty sign-up form (the user would
      // think it failed and sign up again). Bring the inbox screen back into
      // focus instead. An explicit "Sign in" still switches: having opened
      // the link, signing in is the next step.
      if ((mode === 'sent-confirm' || mode === 'sent-reset') && nextMode !== 'signin') {
        setFocusRequest({ target: 'heading', preventScroll: true });
        return;
      }
      if (nextMode && nextMode !== mode) {
        setMode(nextMode);
        clearMessages();
      }
      setFocusRequest({ target: 'email', preventScroll: true });
    },
  }), [mode]);

  // After the change has rendered, so the target is the current element.
  // preventScroll for open(): the page has already brought the form into
  // view (smoothly); a plain focus() would jump there instantly instead.
  useEffect(() => {
    if (!focusRequest) return;
    const el = focusRequest.target === 'heading' ? headingRef.current : fieldRefs[focusRequest.target]?.current;
    el?.focus({ preventScroll: !!focusRequest.preventScroll });
    setFocusRequest(null);
  }, [focusRequest]);

  useEffect(() => {
    onSentChange?.(mode === 'sent-confirm' ? 'confirm' : mode === 'sent-reset' ? 'reset' : null);
  }, [mode, onSentChange]);

  // Re-render once the resend cooldown ends, so the button comes back.
  useEffect(() => {
    if (!resend.sentAt) return undefined;
    const t = setTimeout(() => forceTick((n) => n + 1), RESEND_COOLDOWN_MS);
    return () => clearTimeout(t);
  }, [resend.sentAt]);

  const showProblems = (problems) => {
    const byField = {};
    let whole = null;
    for (const p of problems) {
      if (p.field && !byField[p.field]) byField[p.field] = p;
      else if (!p.field && !whole) whole = p;
    }
    setFieldErrors(byField);
    setFormError(whole);
    const first = ['email', 'password', 'confirm'].find((f) => byField[f]);
    if (first) setFocusRequest({ target: first });
  };

  const handleGoogleSignIn = async () => {
    clearMessages();
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      showProblems([describeAuthError(error)]);
      setGoogleLoading(false);
    }
    // On success the browser navigates away to Google — nothing left to reset.
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || googleLoading) return;
    clearMessages();
    const problems = validateAuthForm(mode, { email, password, confirmPassword });
    if (problems.length) {
      showProblems(problems);
      return;
    }

    const address = email.trim();
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        // On success Login's effect sees the session and leaves this page.
        if (error) showProblems([describeAuthError(error)]);
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { data: { full_name: '' } },
        });
        if (error) showProblems([describeAuthError(error)]);
        // Default Supabase settings need the email confirmed before a session
        // exists: signUp() succeeds but leaves you signed out.
        else if (signUpNeedsConfirmation(data)) switchMode('sent-confirm');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) showProblems([describeAuthError(error)]);
        // Same screen whether or not the email is registered — confirming
        // "no account with that address" would let anyone probe which
        // emails have a Sippd account.
        else switchMode('sent-reset');
      }
    } catch (err) {
      showProblems([describeAuthError(err)]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setFormError(null);
    setResend({ sending: true, sentAt: 0 });
    const address = email.trim();
    try {
      const { error } = mode === 'sent-reset'
        ? await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/reset-password` })
        : await supabase.auth.resend({ type: 'signup', email: address });
      if (error) {
        setFormError(describeAuthError(error));
        setResend({ sending: false, sentAt: 0 });
        return;
      }
      setResend({ sending: false, sentAt: Date.now() });
      if (mode !== 'sent-confirm' && mode !== 'sent-reset') setMode('sent-confirm');
    } catch (err) {
      setFormError(describeAuthError(err));
      setResend({ sending: false, sentAt: 0 });
    }
  };

  // An error's next step, as a button inside the message.
  const runAction = (action) => {
    if (action === 'signin') switchMode('signin', 'password');
    else if (action === 'forgot') switchMode('forgot');
    else if (action === 'resend') {
      switchMode('sent-confirm');
      handleResend();
    }
  };
  const ACTION_LABELS = { signin: 'Sign in instead', forgot: 'Reset your password', resend: 'Send a new link' };

  const errorText = (problem) => (
    <>
      {problem.message}
      {problem.action && (
        <>
          {' '}
          <button type="button" onClick={() => runAction(problem.action)} className="underline underline-offset-2 font-semibold text-foreground hover:text-primary">
            {ACTION_LABELS[problem.action]}
          </button>
        </>
      )}
    </>
  );

  const onField = (setter, field) => (e) => {
    setter(e.target.value);
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (formError) setFormError(null);
  };

  const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;

  const [title, subtitle] = HEADINGS[mode];
  const sent = mode === 'sent-confirm' || mode === 'sent-reset';
  const coolingDown = resend.sentAt && Date.now() - resend.sentAt < RESEND_COOLDOWN_MS;

  const heading = (
    <h2
      ref={headingRef}
      id="auth-heading"
      tabIndex={-1}
      className="font-display font-black text-2xl text-foreground mb-1 focus:outline-none"
    >
      {title}
    </h2>
  );

  if (sent) {
    return (
      <div className="w-full max-w-sm mx-auto space-y-6 text-center">
        <div>
          <div className="mx-auto mb-5 w-16 h-16 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
            <MailCheck className="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          {heading}
          <p className="text-sm font-body text-muted-foreground mt-2">
            {mode === 'sent-confirm' ? (
              <>We sent a link to <strong className="font-semibold text-foreground break-all">{email.trim()}</strong>. Open it to finish creating your account.</>
            ) : (
              <>If there&apos;s an account for <strong className="font-semibold text-foreground break-all">{email.trim()}</strong>, we&apos;ve sent it a link to reset the password.</>
            )}
          </p>
          <p className="text-xs font-body text-muted-foreground mt-3">Can&apos;t find it? Check your spam folder, or send it again.</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resend.sending || !!coolingDown}
            className={`${PILL_OUTLINE} w-full`}
          >
            {resend.sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {coolingDown ? 'Sent again' : 'Send it again'}
          </button>
          <p role="status" className="text-xs font-mono text-muted-foreground min-h-4">
            {coolingDown ? "We've sent another link. It can take a minute to arrive." : ''}
          </p>
          {formError && <ErrorLine alert>{errorText(formError)}</ErrorLine>}
        </div>

        <div className="flex flex-col items-center text-xs font-mono">
          <button type="button" onClick={() => switchMode(mode === 'sent-confirm' ? 'signup' : 'forgot', 'email')} className={LINK}>
            Use a different email
          </button>
          <button type="button" onClick={() => switchMode('signin', 'password')} className={LINK}>
            {mode === 'sent-confirm' ? 'Already confirmed? Sign in' : 'Back to sign in'}
          </button>
        </div>

        <LegalFooter />
      </div>
    );
  }

  const busy = submitting || googleLoading;
  const passwordMet = password.length >= MIN_PASSWORD;

  return (
    <div className="w-full max-w-sm mx-auto space-y-5">
      <div className="text-center mb-2">
        {heading}
        <p className="text-sm font-body text-muted-foreground">{subtitle}</p>
      </div>

      {mode !== 'forgot' && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className={`${PILL_OUTLINE} w-full`}
          >
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-2xs font-mono text-muted-foreground uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </>
      )}

      {/* noValidate: the form runs its own checks, so every message is in
          the page's words and tied to its field, not a browser bubble. */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className={LABEL}>Email</Label>
          <Input
            ref={emailRef}
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={onField(setEmail, 'email')}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={describedBy(fieldErrors.email && 'login-email-error')}
            className={FIELD}
          />
          {fieldErrors.email && <ErrorLine id="login-email-error">{errorText(fieldErrors.email)}</ErrorLine>}
        </div>

        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <Label htmlFor="login-password" className={LABEL}>Password</Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={onField(setPassword, 'password')}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={describedBy(mode === 'signup' && 'login-password-hint', fieldErrors.password && 'login-password-error')}
                className={cn(FIELD, 'pr-12')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-label="Show password"
                aria-controls={mode === 'signup' ? 'login-password login-confirm-password' : 'login-password'}
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            {mode === 'signup' && (
              <p id="login-password-hint" className={cn('flex items-center gap-1.5 text-xs font-mono', passwordMet ? 'text-foreground' : 'text-muted-foreground')}>
                {passwordMet
                  ? <Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  : <span className="w-3.5 h-3.5 flex items-center justify-center" aria-hidden="true"><span className="w-1 h-1 rounded-full bg-current" /></span>}
                At least {MIN_PASSWORD} characters
              </p>
            )}
            {fieldErrors.password && <ErrorLine id="login-password-error">{errorText(fieldErrors.password)}</ErrorLine>}
          </div>
        )}

        {mode === 'signin' && (
          <div className="-mt-2 -mb-1">
            <button type="button" onClick={() => switchMode('forgot', 'email')} className={`${LINK} text-xs font-mono`}>
              Forgot password?
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <div className="space-y-1.5">
            <Label htmlFor="login-confirm-password" className={LABEL}>Confirm Password</Label>
            <Input
              ref={confirmRef}
              id="login-confirm-password"
              name="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={onField(setConfirmPassword, 'confirm')}
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.confirm}
              aria-describedby={describedBy(fieldErrors.confirm && 'login-confirm-error')}
              className={FIELD}
            />
            {fieldErrors.confirm && <ErrorLine id="login-confirm-error">{errorText(fieldErrors.confirm)}</ErrorLine>}
          </div>
        )}

        {formError && <ErrorLine alert>{errorText(formError)}</ErrorLine>}

        {/* aria-disabled, not disabled, while a request runs: a disabled
            button drops keyboard focus to the page, so after an error the
            user would land back at the top instead of on the form. */}
        <button type="submit" aria-disabled={busy} className={cn(PILL, 'w-full', busy && 'opacity-50 cursor-default')}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {mode === 'signin' ? 'Sign In' : mode === 'forgot' ? 'Send Reset Link' : 'Sign Up'}
        </button>
      </form>

      <p className="text-center text-xs font-mono text-muted-foreground">
        {mode === 'forgot' ? (
          <button type="button" onClick={() => switchMode('signin')} className={LINK}>
            Back to sign in
          </button>
        ) : (
          <>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className={LINK}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </>
        )}
      </p>

      <LegalFooter />
    </div>
  );
});

export default AuthPanel;
