import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

// Locks html/body scroll for as long as an AppLayout page is mounted.
// h-dvh + flex-1 overflow-y-auto on <main> already sizes things to sum to
// exactly the viewport height, but that's arithmetic, not a guarantee —
// any sub-pixel rounding (dvh/flexbox/scrollbar-width interactions vary
// by browser) lets html/body scroll independently by a few pixels, which
// both shows up as a second scrollbar AND can steal the scroll gesture
// away from <main> via scroll chaining. This is the hard backstop.
// Scoped to the effect's lifetime, not global CSS, because routes outside
// AppLayout (MonthlyReport, Settings, CanDetail, etc.) have no internal
// scroll container of their own and need normal document-level scroll.
function useLockBodyScroll() {
  useEffect(() => {
    const { documentElement, body } = document;
    documentElement.classList.add('overflow-hidden');
    body.classList.add('overflow-hidden');
    return () => {
      documentElement.classList.remove('overflow-hidden');
      body.classList.remove('overflow-hidden');
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
