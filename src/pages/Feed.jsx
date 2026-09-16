import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import FeedContent from '@/components/feed/FeedContent';

// Thin wrapper — the actual feed body lives in FeedContent.jsx, shared
// with Leaderboard.jsx's own "Feed" tab (/impeccable critique: Feed
// consolidated into Ranks to ease bottom-nav crowding). This route still
// exists for direct links (Home's FeedPreview "See all") and the
// ?tab=following deep link it uses — it's just no longer a bottom-nav
// item, so it gets a back-chevron header like every other contextual page
// instead of the tab-bar chrome.
export default function Feed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'following' ? 'following' : 'global';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Feed" subtitle="Community activity" onBack={() => navigate(-1)} showBell={false} />
      <FeedContent defaultTab={defaultTab} />
    </div>
  );
}
