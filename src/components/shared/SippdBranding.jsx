// Extracted from PublicProfile.jsx's own inline footer — the same "Track
// your energy drink collection at Sippd" line, now shared with
// SharedCrate.jsx so a second standalone, no-AppLayout page doesn't grow
// its own copy of it to drift out of sync later.
export default function SippdBranding() {
  return (
    <div className="pt-4 border-t border-border text-center">
      <p className="text-[11px] font-mono text-muted-foreground">
        Track your energy drink collection at{' '}
        <a href="/" className="text-primary underline">Sippd</a>
      </p>
    </div>
  );
}
