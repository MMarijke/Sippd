import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Reached only via the link in a Supabase "reset password" email
// (redirectTo set in Login.jsx's handleForgotSubmit). Supabase's client
// auto-detects the recovery tokens in the URL on load (detectSessionInUrl
// defaults to true) and fires a PASSWORD_RECOVERY auth event with a real,
// temporary session — this page waits for that, then lets the user set a
// new password with updateUser().
//
// Clears the query cache on arrival, the same defensive move
// useAuth.js's signOut() already makes for the opposite direction — if a
// *different* account's session was active in this browser when the
// recovery link landed (shared device, stale tab), the recovery session
// silently becomes the active one with no explicit sign-out in between,
// so stale cached data from the previous account must never carry over.
export default function ResetPassword() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'invalid'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    queryClient.clear();

    let settled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        settled = true;
        setStatus('ready');
      }
    });

    // onAuthStateChange only fires for an event that happens *after* this
    // listener attaches — if Supabase already processed the recovery
    // tokens (and fired PASSWORD_RECOVERY) before this component mounted,
    // fall back to checking for an existing session directly instead of
    // waiting forever for an event that already happened.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return;
      if (session) {
        settled = true;
        setStatus('ready');
      } else {
        // Give URL-detection a brief moment before giving up — it runs
        // synchronously on client init in practice, but this avoids a
        // hard race against that internal timing.
        setTimeout(() => {
          if (!settled) setStatus('invalid');
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success('Password updated');
    navigate('/', { replace: true });
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-3">
        <h1 className="text-sm font-display font-semibold text-foreground">This reset link is invalid or has expired</h1>
        <p className="text-xs font-mono text-muted-foreground">Request a new one from the sign-in page.</p>
        <Button
          size="sm"
          className="h-11 mt-2 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => navigate('/login')}
        >
          Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex items-center gap-2 justify-center">
          <Zap className="w-5 h-5 text-primary" />
          <span className="font-display font-black text-lg text-foreground tracking-widest">SIPPD</span>
        </div>

        <div className="text-center">
          <h1 className="font-display font-black text-2xl text-foreground mb-1">Set a new password</h1>
          <p className="text-sm font-body text-muted-foreground">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">New password</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="bg-secondary border-border font-body"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm-password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Confirm new password</Label>
            <Input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="bg-secondary border-border font-body"
            />
          </div>

          {/* Icon + text, not colour alone; role="alert" announces it. */}
          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-xs font-mono text-destructive">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full font-mono text-sm gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
