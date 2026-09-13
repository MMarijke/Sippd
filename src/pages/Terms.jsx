import LegalPage from '@/components/legal/LegalPage';
import markdown from '../../docs/terms-of-service.md?raw';

// Renders docs/terms-of-service.md directly (single source of truth) so
// editing the reviewed markdown there is all that's needed to update the
// live page — no parallel copy to keep in sync.
export default function Terms() {
  return <LegalPage title="Terms of Service" markdown={markdown} />;
}
