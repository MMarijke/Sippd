import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import BottomNav from './BottomNav';

// Locks document scroll for as long as an AppLayout page is mounted, so
// <main>'s own overflow-y-auto is the only thing that can ever scroll.
// overflow:hidden on html/body alone is NOT enough — iOS Safari still
// rubber-bands/scroll-chains past it via touch gestures, regardless of
// that CSS property (a well-documented WebKit quirk). Pinning body to
// position:fixed removes it from the document flow entirely, so there's
// no scrollable box left for iOS to bounce — this is the same technique
// libraries like body-scroll-lock use specifically because overflow:hidden
// doesn't hold up there.
// Scoped to the effect's lifetime, not global CSS, because routes outside
// AppLayout (MonthlyReport, Settings, CanDetail, etc.) have no internal
// scroll container of their own and need normal document-level scroll.
function useLockBodyScroll() {
  useEffect(() => {
    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    documentElement.classList.add('overflow-hidden');
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    return () => {
      documentElement.classList.remove('overflow-hidden');
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      window.scrollTo(0, scrollY);
    };
  }, []);
}

// Locking body scroll means the browser's native history-based scroll
// restoration (window.scrollY, tracked per history entry) can't do
// anything anymore — window.scrollY never moves now. This restores the
// same behavior scoped to <main>'s own scrollTop instead: back/forward
// nav (POP) restores exactly where that page was left; a normal forward
// navigation (PUSH/REPLACE) starts at the top, same as browsers do by
// default. Keyed on location.key rather than pathname since key is
// per-history-entry — the same entry going back always carries the same
// key, while two separate visits to the same path don't collide.
const mainScrollPositions = new Map();

function useRestoreMainScroll(mainRef) {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    main.scrollTop = navigationType === 'POP'
      ? (mainScrollPositions.get(location.key) ?? 0)
      : 0;

    const handleScroll = () => {
      mainScrollPositions.set(location.key, main.scrollTop);
    };
    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, [location.key, navigationType, mainRef]);
}

export default function AppLayout() {
  useLockBodyScroll();
  const mainRef = useRef(null);
  useRestoreMainScroll(mainRef);

  return (
    <div className="flex flex-col h-dvh bg-background font-body">
      <main ref={mainRef} className="flex-1 overflow-y-auto pb-6 max-w-lg mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
