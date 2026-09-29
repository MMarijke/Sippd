import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner"
import { MotionConfig } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Home from './pages/Home';

// Route-level code splitting (/impeccable audit: everything shipped as one
// 2.4 MB chunk, so a first load mid-shop on a patchy connection paid for
// Monthly Report's html2canvas and every chart up front). Login and Home
// stay eager -- they're the two landing routes, and lazy-loading the first
// screen would only add a round trip. Everything else is its own chunk.
const Scan = lazy(() => import('./pages/Scan'));
const Collection = lazy(() => import('./pages/Collection'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const CanDetail = lazy(() => import('./pages/CanDetail'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Settings = lazy(() => import('./pages/Settings'));
const MonthlyReport = lazy(() => import('./pages/MonthlyReport'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const SharedCrate = lazy(() => import('./pages/SharedCrate'));
const Feed = lazy(() => import('./pages/Feed'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Crates = lazy(() => import('./pages/Crates'));
const CompareCollection = lazy(() => import('./pages/CompareCollection'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Pro = lazy(() => import('./pages/Pro'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Refund = lazy(() => import('./pages/Refund'));

// The other four tab-bar destinations are one tap away from Home, so their
// chunks are warmed once the browser is idle -- a tab switch should never
// wait on the network. Same import() specifiers as above, so Vite resolves
// them to the same chunks and React.lazy finds them already loaded.
function usePrefetchTabRoutes() {
  useEffect(() => {
    const prefetch = () => {
      import('./pages/Scan');
      import('./pages/Collection');
      import('./pages/Leaderboard');
      import('./pages/Profile');
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(prefetch, 1500);
    return () => clearTimeout(t);
  }, []);
}

// Applies the signed-in user's saved theme to <html> for the whole app
// lifetime, independent of which route is mounted — Settings' picker calls
// the same hook's setTheme(), and both share its query cache.
function ThemeEffect() {
  useTheme();
  return null;
}

function App() {
  usePrefetchTabRoutes();

  return (
    // reducedMotion="user": under the OS's reduce-motion setting, framer
    // drops transform/layout animation app-wide but keeps opacity and color,
    // so state changes still read -- a default for every motion component,
    // including ones (CanCard's press scale) that never checked
    // usePrefersReducedMotion themselves. Components that already use that
    // hook for their own tailored alternative keep it. (/impeccable animate)
    <MotionConfig reducedMotion="user">
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <ThemeEffect />
        <Router>
          {/* Blank page-colored fallback, not a spinner: a chunk usually
              lands in well under a second, and a spinner flashing for that
              long reads as jank rather than progress. Tab routes have their
              own boundary inside AppLayout so the bottom nav stays put. */}
          <Suspense fallback={<div className="fixed inset-0 bg-background" />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Public on purpose — reached from the link in a password-reset
                email, before the visitor has any normal session at all.
                Supabase's own recovery tokens in the URL are what actually
                authorize setting a new password here, not this route's
                placement outside ProtectedRoute. */}
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Public on purpose: a shared profile link has to work for
                someone with no Sippd account at all, not just other
                signed-in users. PublicProfile.jsx's own canViewContent
                gate (private/owner/accepted-follower) still applies —
                this only controls whether the page mounts, not what it
                shows. See the 2026-09-12 public-profile migration. */}
            <Route path="/u/:userId" element={<PublicProfile />} />

            {/* Public on purpose — a "capability link" (see get_public_crate's
                migration comment): sharing one crate is a scoped, active
                choice its owner makes, independent of the account's
                is_private setting, so this must work for a visitor with no
                Sippd account at all. */}
            <Route path="/crate/:crateId" element={<SharedCrate />} />

            {/* Public on purpose — required to be live and reachable without
                an account for Paddle's business verification and for any
                visitor deciding whether to sign up, not just existing users. */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund" element={<Refund />} />

            <Route element={<ProtectedRoute />}>
              {/* The five primary tab-bar destinations only — every other
                  route below is reached contextually (a link, not a nav
                  item) and owns its own back-chevron header instead of
                  the bottom nav. Achievements/Wishlist/Feed used to live
                  in here despite not being nav items, which meant the nav
                  rendered with zero items highlighted on all three — a
                  real "where am I" bug, not just a stylistic one.
                  (/impeccable critique) */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/scan" element={<Scan />} />
                <Route path="/collection" element={<Collection />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route path="/can/*" element={<CanDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/monthly-report" element={<MonthlyReport />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/crates" element={<Crates />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/pro" element={<Pro />} />
              <Route path="/compare" element={<CompareCollection />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
    </MotionConfig>
  )
}

export default App
