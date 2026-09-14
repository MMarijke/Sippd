import LegalPage from '@/components/legal/LegalPage';
import markdown from '../../docs/privacy-policy.md?raw';

// Renders docs/privacy-policy.md directly (single source of truth) so
// editing the reviewed markdown there is all that's needed to update the
// live page — no parallel copy to keep in sync.
export default function Privacy() {
  return <LegalPage title="Privacy Policy" markdown={markdown} />;
}
