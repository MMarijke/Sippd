import LegalPage from '@/components/legal/LegalPage';
import markdown from '../../docs/refund-policy.md?raw';

// Renders docs/refund-policy.md directly (single source of truth) so
// editing the reviewed markdown there is all that's needed to update the
// live page — no parallel copy to keep in sync.
export default function Refund() {
  return <LegalPage title="Refund & Cancellation Policy" markdown={markdown} />;
}
