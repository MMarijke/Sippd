import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { supabase } from '@/lib/supabaseClient';
import { NATIVE_REDIRECT, parseAuthCallback } from '@/lib/oauthCallback';

// "Continue with Google", on the web and in the Android app.
//
// Web: Supabase sends the page to Google and back to this site's origin;
// supabase-js picks the session out of the URL on return (implicit flow,
// detectSessionInUrl), and Login's effect leaves the page once it exists.
//
// Android: Google refuses sign-in inside an app's embedded web view, so the
// app opens Google in a Custom Tab (@capacitor/browser) and Supabase ends
// at NATIVE_REDIRECT, which the manifest's intent filter routes back into
// the app; listenForNativeAuthCallback() turns it into a session.

const isNative = () => Capacitor.isNativePlatform();

// App.getLaunchUrl() keeps returning the URL that cold-started the app for
// the whole session, so it's handled once: signing out later and coming
// back to Login must not replay old tokens.
let launchUrlHandled = false;

// Supabase's public settings say whether Google is switched on. Checked
// first because a disabled provider doesn't come back to the app with an
// error: the browser lands on a raw JSON error page instead.
async function googleEnabled() {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    if (!res.ok) return true; // can't tell: let the real attempt decide
    const settings = await res.json();
    return settings?.external?.google !== false;
  } catch {
    return true;
  }
}

// Starts sign-in. Resolves with { error } when it couldn't start (the form
// shows it); on the web a successful start navigates away and never
// resolves into anything useful. On Android it resolves once the Custom Tab
// is open; the result arrives later through the callback listener.
export async function startGoogleSignIn() {
  if (!(await googleEnabled())) {
    return { error: { code: 'google_disabled', message: 'Google provider is not enabled' } };
  }

  if (!isNative()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) return { error };
  await Browser.open({ url: data.url, windowName: '_self' });
  return { error: null };
}

// Android only. Calls onResult({ error }) when a callback fails, and
// onClosed() when the user closes the Custom Tab without finishing (so the
// form can stop its spinner). A successful callback sets the session; the
// app's auth listener takes it from there. Also handles a callback that
// cold-started the app. Returns a cleanup function.
export function listenForNativeAuthCallback({ onResult, onClosed }) {
  if (!isNative()) return () => {};

  const handle = async (url) => {
    const parsed = parseAuthCallback(url);
    if (!parsed) return;
    Browser.close().catch(() => {});
    if (parsed.error) {
      onResult?.({ error: parsed.error });
      return;
    }
    const { error } = await supabase.auth.setSession(parsed.tokens);
    onResult?.({ error });
  };

  const subs = [
    App.addListener('appUrlOpen', ({ url }) => handle(url)),
    Browser.addListener('browserFinished', () => onClosed?.()),
  ];
  if (!launchUrlHandled) {
    launchUrlHandled = true;
    App.getLaunchUrl().then((launch) => launch?.url && handle(launch.url)).catch(() => {});
  }

  return () => {
    subs.forEach((p) => p.then((s) => s.remove()).catch(() => {}));
  };
}
