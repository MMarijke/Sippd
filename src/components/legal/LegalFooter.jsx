import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

// Reused on Login (the only page a signed-out visitor lands on) and Pro
// (right where a purchase decision is made) so Terms/Privacy/Refund are
// reachable without an account and contact info sits within two clicks of
// the homepage — both explicit Paddle business-verification checks.
//
// CONTACT_EMAIL is intentionally a visible placeholder, not a real address
// — inventing one would look done without being done, and Paddle's
// verification will actually try to use it. Replace with a real support
// inbox before publishing; the yellow styling here matches the same
// "needs review" convention used throughout docs/*.md and LegalPage.jsx so
// it can't be mistaken for finished copy.
const CONTACT_EMAIL = null;

export default function LegalFooter({ className = '' }) {
  return (
    <div className={`text-center space-y-2 ${className}`}>
      <p className="text-[11px] font-mono text-muted-foreground">
        <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link>
        {' · '}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy</Link>
        {' · '}
        <Link to="/refund" className="underline underline-offset-2 hover:text-foreground">Refund Policy</Link>
      </p>
      {CONTACT_EMAIL ? (
        <p className="text-[11px] font-mono text-muted-foreground">
          Questions? <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>
        </p>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-mono text-yellow-400">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          NEEDS REVIEW — add a real support contact email
        </p>
      )}
    </div>
  );
}
