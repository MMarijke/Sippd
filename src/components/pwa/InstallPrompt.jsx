import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DISMISS_KEY, installPromptKind } from '@/lib/offline/installPrompt';

function readDismissedAt() {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// A quiet, dismissible card offering to install Sippd as an app (so it opens
// offline from the home screen). Chrome-family browsers get a real Install
// button; iOS Safari, which has no install API, gets the Share -> Add to
// Home Screen steps. Renders nothing when installed, inside the Capacitor
// app, or for 30 days after a dismissal (see lib/offline/installPrompt.js).
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault(); // keep Chrome's own mini-infobar from competing
      setDeferred(event);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const kind = installPromptKind({
    isStandalone: installed,
    isNative: Capacitor.isNativePlatform(),
    hasDeferredPrompt: Boolean(deferred),
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    dismissedAt,
  });
  if (!kind) return null;

  const dismiss = () => {
    const now = String(Date.now());
    try { localStorage.setItem(DISMISS_KEY, now); } catch { /* private mode: dismiss for this visit only */ }
    setDismissedAt(now);
  };

  const install = async () => {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // a prompt event can only be used once
    if (outcome === 'dismissed') dismiss();
  };

  return (
    <div className="px-5 mt-5">
      <section
        aria-labelledby="install-prompt-title"
        className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3"
      >
        <span className="mt-0.5 text-primary flex-shrink-0" aria-hidden="true">
          {kind === 'native' ? <Download className="w-5 h-5" /> : <Share className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="install-prompt-title" className="text-sm font-display font-semibold text-foreground">
            Install Sippd
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {kind === 'native'
              ? 'Open your collection from your home screen, even without a connection.'
              : 'Tap Share, then Add to Home Screen, to open your collection like an app, even offline.'}
          </p>
          {kind === 'native' && (
            <Button size="sm" className="h-11 mt-3 font-mono text-xs" onClick={install}>
              Install
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install suggestion"
          className="-mr-2 -mt-2 w-11 h-11 rounded-control flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}
