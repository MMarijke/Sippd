import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
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
//
// Trade-off: this also defeats the browser's native scroll-position
// restoration on back/forward nav (it restores window.scrollY, not an
// arbitrary div's scrollTop) — accepted for now, since the alternative is
// content genuinely hidden behind the nav on short viewports.
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

export default function AppLayout() {
  useLockBodyScroll();

  return (
    <div className="flex flex-col h-dvh bg-background font-body">
      <main className="flex-1 overflow-y-auto pb-6 max-w-lg mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
