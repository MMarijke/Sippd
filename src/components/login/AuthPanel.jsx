import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import LegalFooter from '@/components/legal/LegalFooter';
import { PILL, PILL_OUTLINE } from '@/components/login/pill';

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
// one-handed on a phone.
const FIELD = 'h-11 rounded-xl bg-secondary border-border font-body';
const LINK = 'inline-flex items-center min-h-11 px-2 -mx-2 text-primary hover:underline underline-offset-2';

// The sign-up / sign-in / reset form, used by both the web page and the
// Android app's Login screen. It owns its own state; the page drives it
// through the ref: open(mode) switches mode and puts the cursor in Email,
// for "Get Started" and the header's "Sign in".
const AuthPanel = forwardRef(function AuthPanel(_props, ref) {
  // Defaults to 'signup': on the web, a visitor who reaches the form
  // without tapping a specific button came through the pitch above it.
  const [mode, setMode] = useState('signup'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const emailRef = useRef(null);
  const [focusRequest, setFocusRequest] = useState(0);

  useImperativeHandle(ref, () => ({
    open(nextMode) {
      if (nextMode && nextMode !== mode) {
        setMode(nextMode);
        setError('');
        setInfoMessage('');
      }
      setFocusRequest((n) => n + 1);
    },
  }), [mode]);

  // After the mode switch has rendered, so the field is the current one.
  // preventScroll: the page has already brought the form into view (smoothly);
  // a plain focus() would jump there instantly instead.
  useEffect(() => {
    if (focusRequest) emailRef.current?.focus({ preventScroll: true });
  }, [focusRequest]);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // On success the browser navigates away to Google — nothing left to reset.
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setEmailLoading(true);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: '' } },
      });
      if (error) {
        setError(error.message);
      } else if (!data.session) {
        // Default Supabase project settings require email confirmation before
        // a session exists — signUp() succeeds but leaves you logged out.
        setInfoMessage('Check your email to confirm your account before signing in.');
      }
    }

    setEmailLoading(false);
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError('');
    setInfoMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  const enterForgotMode = () => {
    setMode('forgot');
    setError('');
    setInfoMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  const backToSignIn = () => {
    setMode('signin');
    setError('');
    setInfoMessage('');
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Same message whether or not the email is actually registered —
    // confirming "no account with that address" to whoever typed it would
    // let anyone probe which emails have a Sippd account.
    setInfoMessage("If an account exists for that email, we've sent a password reset link.");
  };

  // Icon + text, so the error isn't carried by colour alone (it can sit
  // near a red main colour: Boss Fight, Crimson, Cherry Pop, Brick);
  // role="alert" announces it.
  const messages = (
    <>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-mono text-destructive">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {infoMessage && <p className="text-xs font-mono text-primary">{infoMessage}</p>}
    </>
  );

  const emailField = (
    <div className="space-y-1.5">
      <Label htmlFor="login-email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</Label>
      <Input
        ref={emailRef}
        id="login-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className={FIELD}
      />
    </div>
  );

  return (
    <div className="w-full max-w-sm mx-auto space-y-5">
      <div className="text-center mb-2">
        <h2 id="auth-heading" className="font-display font-black text-2xl text-foreground mb-1">
          {mode === 'signin' ? 'Welcome back' : mode === 'forgot' ? 'Reset your password' : 'Start your vault'}
        </h2>
        <p className="text-sm font-body text-muted-foreground">
          {mode === 'signin' ? 'Sign in to pick up where you left off.'
            : mode === 'forgot' ? "Enter your email and we'll send you a reset link."
            : 'Free to join, free to collect.'}
        </p>
      </div>

      {mode !== 'forgot' && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || emailLoading}
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

      {mode === 'forgot' ? (
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          {emailField}
          {messages}
          <button type="submit" disabled={resetSending} className={`${PILL} w-full`}>
            {resetSending && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Reset Link
          </button>
        </form>
      ) : (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {emailField}

          <div className="space-y-1.5">
            <Label htmlFor="login-password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className={FIELD}
            />
          </div>

          {mode === 'signin' && (
            <div className="-mt-2 -mb-1">
              <button type="button" onClick={enterForgotMode} className={`${LINK} text-xs font-mono`}>
                Forgot password?
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="login-confirm-password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
              <Input
                id="login-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className={FIELD}
              />
            </div>
          )}

          {messages}

          <button type="submit" disabled={emailLoading || googleLoading} className={`${PILL} w-full`}>
            {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
      )}

      <p className="text-center text-xs font-mono text-muted-foreground">
        {mode === 'forgot' ? (
          <button type="button" onClick={backToSignIn} className={LINK}>
            Back to sign in
          </button>
        ) : (
          <>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={toggleMode} className={LINK}>
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
