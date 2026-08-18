import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

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

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // Once a session exists (password sign-in, or the OAuth redirect landing
  // back with one), leave the login page.
  useEffect(() => {
    if (user) navigate('/', { replace: true });
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">⚡</span>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-wide">Sippd</h1>
        </div>

        <div className="space-y-5">
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

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-secondary border-border font-body"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="bg-secondary border-border font-body"
              />
            </div>

            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                <Input
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

          <p className="text-center text-xs font-mono text-muted-foreground">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-primary hover:underline underline-offset-2"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
