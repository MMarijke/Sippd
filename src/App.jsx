import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
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
import MostWanted from './pages/MostWanted';
import Feed from './pages/Feed';
import Notifications from './pages/Notifications';
import Crates from './pages/Crates';
import CompareCollection from './pages/CompareCollection';
import Wishlist from './pages/Wishlist';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

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
              <Route path="/most-wanted" element={<MostWanted />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/crates" element={<Crates />} />
              <Route path="/u/:userId" element={<PublicProfile />} />
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
