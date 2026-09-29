import { Link } from 'react-router-dom';

// Reused on Login (the only page a signed-out visitor lands on) and Pro
// (right where a purchase decision is made) so Terms/Privacy/Refund are
// reachable without an account and contact info sits within two clicks of
// the homepage — both explicit Paddle business-verification checks.
//
// Matches the contact address now used consistently across
// docs/privacy-policy.md, docs/refund-policy.md, and
// docs/terms-of-service.md — was a deliberate null placeholder before
// those three docs settled on a real address.
const CONTACT_EMAIL = 'seedstackstudio@gmail.com';

export default function LegalFooter({ className = '' }) {
  return (
    <div className={`text-center space-y-2 ${className}`}>
      <p className="text-2xs font-mono text-muted-foreground">
        <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link>
        {' · '}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy</Link>
        {' · '}
        <Link to="/refund" className="underline underline-offset-2 hover:text-foreground">Refund Policy</Link>
      </p>
      <p className="text-2xs font-mono text-muted-foreground">
        Questions? <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>
      </p>
    </div>
  );
}
