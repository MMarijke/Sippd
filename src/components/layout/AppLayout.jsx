import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import QuickAccessFAB from './QuickAccessFAB';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background font-body">
      <main className="pb-24 max-w-lg mx-auto">
        <Outlet />
      </main>
      <QuickAccessFAB />
      <BottomNav />
    </div>
  );
}