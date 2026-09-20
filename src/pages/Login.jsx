import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import LegalFooter from '@/components/legal/LegalFooter';
import HeroReveal from '@/components/login/HeroReveal';
import { LeaderboardProof, FeedProof, CollectionProof } from '@/components/login/ProofSections';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

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

const POST_LOGIN_REDIRECT_KEY = 'sippd-post-login-redirect';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const formSectionRef = useRef(null);

  // Defaults to 'signup', not 'signin' — this page's job is now persuading
  // a first-time visitor (the whole scroll above builds toward exactly
  // that), so a reader who scrolls all the way down without tapping a
  // specific CTA should land on the form built for them. The compact "Sign
  // in" link in the hero explicitly switches this back for a returning
  // user skipping the tour. (/impeccable)
  const [mode, setMode] = useState('signup'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  // A page can send someone here via navigate('/login', { state: { from } })
  // — e.g. PublicProfile.jsx's "Sign In to Follow" — expecting to land back
  // where they actually wanted to act, not on the home dashboard having lost
  // their place. router state doesn't survive Google's full-page redirect
  // round trip, so this persists it to sessionStorage on arrival instead;
  // the effect below reads it back regardless of which sign-in path was
  // used, then clears it so a later, unrelated login doesn't reuse it.
  useEffect(() => {
    if (location.state?.from) {
      sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, location.state.from);
    }
  }, [location.state]);

  // Once a session exists (password sign-in, or the OAuth redirect landing
  // back with one), leave the login page.
  useEffect(() => {
    if (!user) return;
    const from = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    navigate(from || '/', { replace: true });
  }, [user, navigate]);

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

  // Scrolls to the sign-in/sign-up form rather than a separate route or
  // modal — the form doesn't move, so nothing about how it already works
  // (Google OAuth, the post-login redirect above, email confirmation) needs
  // to change. "Get Started" additionally sets signup mode: a first-time
  // visitor tapping it from the hero clearly wants an account, not to sign
  // into one they don't have yet.
  const scrollToForm = (targetMode) => {
    if (targetMode) setMode(targetMode);
    formSectionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background">
      <HeroReveal
        onGetStarted={() => scrollToForm('signup')}
        onJumpToSignIn={() => scrollToForm('signin')}
      />

      <LeaderboardProof />
      <FeedProof />
      <CollectionProof />

      <div ref={formSectionRef} className="px-5 py-16 border-t border-border scroll-mt-4">
        <div className="w-full max-w-sm mx-auto space-y-5">
          <div className="text-center mb-2">
            <h2 className="font-display font-black text-2xl text-foreground mb-1">
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
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || emailLoading}
                className="w-full font-mono text-sm gap-2 border-border bg-secondary hover:bg-secondary/80"
              >
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          {mode === 'forgot' ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-secondary border-border font-body"
                />
              </div>

              {error && <p className="text-xs font-mono text-destructive">{error}</p>}
              {infoMessage && <p className="text-xs font-mono text-primary">{infoMessage}</p>}

              <Button
                type="submit"
                disabled={resetSending}
                className="w-full font-mono text-sm gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
              >
                {resetSending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-secondary border-border font-body"
                />
              </div>

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
                  className="bg-secondary border-border font-body"
                />
              </div>

              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={enterForgotMode}
                  className="block text-xs font-mono text-primary hover:underline underline-offset-2 -mt-2"
                >
                  Forgot password?
                </button>
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
                    className="bg-secondary border-border font-body"
                  />
                </div>
              )}

              {error && <p className="text-xs font-mono text-destructive">{error}</p>}
              {infoMessage && <p className="text-xs font-mono text-primary">{infoMessage}</p>}

              <Button
                type="submit"
                disabled={emailLoading || googleLoading}
                className="w-full font-mono text-sm gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
              >
                {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>
          )}

          <p className="text-center text-xs font-mono text-muted-foreground">
            {mode === 'forgot' ? (
              <button
                type="button"
                onClick={backToSignIn}
                className="text-primary hover:underline underline-offset-2"
              >
                Back to sign in
              </button>
            ) : (
              <>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-primary hover:underline underline-offset-2"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </>
            )}
          </p>

          <LegalFooter />
        </div>
      </div>
    </div>
  );
}
