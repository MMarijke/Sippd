import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/lib/AuthContext';
import HeroReveal from '@/components/login/HeroReveal';
import AuthPanel from '@/components/login/AuthPanel';
import LegalFooter from '@/components/legal/LegalFooter';
import { RarityProof, LeaderboardProof, FeedProof, CollectionProof } from '@/components/login/ProofSections';
import { PILL } from '@/components/login/pill';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const POST_LOGIN_REDIRECT_KEY = 'sippd-post-login-redirect';

// Android app: the opening plays once per install, then hands over to the
// form. Someone opening the app already chose Sippd in the Play Store, so
// the web page's proof sections are skipped there.
const INTRO_SEEN_KEY = 'sippd-login-intro-seen';
// Long enough for the reveal to land (~1.6s) and the one-line pitch to be read.
const INTRO_MS = 4000;

function introAlreadySeen() {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Storage blocked: the intro just plays again next time.
  }
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const formSectionRef = useRef(null);
  const panelRef = useRef(null);

  const native = Capacitor.isNativePlatform();
  // Reduced motion skips the intro: without its motion it's a static
  // screen standing between the user and the form.
  const [introDone, setIntroDone] = useState(() => !native || reducedMotion || introAlreadySeen());
  // 'confirm' | 'reset' once the form has sent an email (AuthPanel's
  // onSentChange), else null. While set, the page stops selling: the proof
  // sections and closing call collapse, and the opening's button points at
  // the inbox screen instead of offering a second sign-up.
  const [sent, setSent] = useState(null);
  // Mode/focus request made from the intro, applied once the form mounts.
  const pendingOpen = useRef(null);

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

  // Android intro: auto-advance to the form.
  useEffect(() => {
    if (introDone) return undefined;
    const t = setTimeout(() => finishIntro(null), INTRO_MS);
    return () => clearTimeout(t);
  }, [introDone]);

  // The form has just replaced the intro: apply a tapped button's mode.
  useEffect(() => {
    if (introDone && pendingOpen.current) {
      panelRef.current?.open(pendingOpen.current);
      pendingOpen.current = null;
    }
  }, [introDone]);

  function finishIntro(mode) {
    pendingOpen.current = mode;
    markIntroSeen();
    setIntroDone(true);
  }

  // Web: bring the form into view (unless it already is, as beside the
  // opening on desktop) and put the cursor in Email, so "Get Started" and
  // "Sign in" both land the user in the form, ready to type.
  const openForm = (mode) => {
    const section = formSectionRef.current;
    if (section) {
      const top = section.getBoundingClientRect().top;
      const inView = top >= 0 && top < window.innerHeight * 0.5;
      if (!inView) section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
    panelRef.current?.open(mode);
  };

  if (native) {
    if (!introDone) {
      return (
        <div className="login-world">
          <HeroReveal
            onGetStarted={() => finishIntro('signup')}
            onJumpToSignIn={() => finishIntro('signin')}
          />
        </div>
      );
    }
    return (
      <div
        className="login-world min-h-dvh flex flex-col px-5"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">⚡</span>
          <span className="text-sm font-display font-bold text-foreground tracking-wide">Sippd</span>
        </div>
        <motion.main
          className="flex-1 flex items-center py-8"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          aria-labelledby="auth-heading"
        >
          <AuthPanel ref={panelRef} />
        </motion.main>
        <footer>
          <LegalFooter />
        </footer>
      </div>
    );
  }

  return (
    // .login-world (index.css): the opening's magenta-on-black for the
    // whole page, whatever theme this device has cached.
    <div className="login-world min-h-screen">
      {/* Phone: the form comes straight after the opening, not after the
          proof sections. Desktop: it sits beside the opening, so the page
          can be used without scrolling at all. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
        <HeroReveal
          onGetStarted={() => openForm('signup')}
          onJumpToSignIn={() => openForm('signin')}
          ctaLabel={sent ? 'Check your inbox' : 'Get Started'}
          showScrollHint={!sent}
        />

        <section
          ref={formSectionRef}
          aria-labelledby="auth-heading"
          className="px-5 py-16 border-t border-border scroll-mt-4 lg:border-t-0 lg:border-l lg:flex lg:items-center lg:px-12"
        >
          <AuthPanel ref={panelRef} onSentChange={setSent} />
        </section>
      </div>

      {!sent && (
        <>
          <RarityProof />
          <LeaderboardProof />
          <FeedProof />
          <CollectionProof />

          {/* The proof sections end on a way back to the form. */}
          <section className="px-5 py-20 border-t border-border text-center">
            <h2 className="font-display font-black text-3xl lg:text-4xl text-foreground mb-2 text-balance">
              Your vault is waiting<span className="text-primary">.</span>
            </h2>
            <p className="text-sm lg:text-base font-body text-muted-foreground mb-8">Free to join, free to collect.</p>
            <button type="button" onClick={() => openForm('signup')} className={PILL}>
              Start your vault
            </button>
          </section>
        </>
      )}

      {/* Legal and contact, out of the sign-up card (the card carries only
          the consent line). Always shown, including on "Check your inbox":
          Terms/Privacy/Refund must stay reachable without an account. */}
      <footer className="px-5 py-8 border-t border-border">
        <LegalFooter />
      </footer>
    </div>
  );
}
