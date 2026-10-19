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

// Each link gets a 44px-tall tap area around its 12px text (the visible
// text stays small; the target doesn't), so they're usable one-handed.
const LINK = 'inline-flex items-center min-h-11 px-2 underline underline-offset-2 hover:text-foreground';

export default function LegalFooter({ className = '' }) {
  return (
    <div className={`text-center ${className}`}>
      <p className="flex flex-wrap items-center justify-center text-xs font-mono text-muted-foreground">
        <Link to="/terms" className={LINK}>Terms</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className={LINK}>Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link to="/refund" className={LINK}>Refund Policy</Link>
      </p>
      <p className="flex flex-wrap items-center justify-center text-xs font-mono text-muted-foreground">
        Questions?
        <a href={`mailto:${CONTACT_EMAIL}`} className={`${LINK} text-primary hover:text-primary break-all`}>{CONTACT_EMAIL}</a>
      </p>
    </div>
  );
}
