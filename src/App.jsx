import { Toaster } from "@/components/ui/sonner"
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
import Scan from './pages/Scan';
import Collection from './pages/Collection';
import CanDetail from './pages/CanDetail';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Achievements from './pages/Achievements';
import Settings from './pages/Settings';
import MonthlyReport from './pages/MonthlyReport';
import PublicProfile from './pages/PublicProfile';
import SharedCrate from './pages/SharedCrate';
import Feed from './pages/Feed';
import Notifications from './pages/Notifications';
import Crates from './pages/Crates';
import CompareCollection from './pages/CompareCollection';
import Wishlist from './pages/Wishlist';
import Pro from './pages/Pro';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Refund from './pages/Refund';

// Applies the signed-in user's saved theme to <html> for the whole app
// lifetime, independent of which route is mounted — Settings' picker calls
// the same hook's setTheme(), and both share its query cache.
function ThemeEffect() {
  useTheme();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <ThemeEffect />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
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
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/scan" element={<Scan />} />
                <Route path="/collection" element={<Collection />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/wishlist" element={<Wishlist />} />
              </Route>
              <Route path="/can/*" element={<CanDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/monthly-report" element={<MonthlyReport />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/crates" element={<Crates />} />
              <Route path="/pro" element={<Pro />} />
              <Route path="/compare" element={<CompareCollection />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
