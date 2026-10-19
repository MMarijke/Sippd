// The sign-up page's one button shape: the opening's magenta pill. Every
// action on the page uses it, so "Get Started", "Sign Up" and "Start your
// vault" read as the same kind of thing. Colours come from .login-world
// (index.css): --primary-fill is the reveal's #FF00FF there.
export const PILL =
  'h-11 px-6 rounded-full inline-flex items-center justify-center gap-2 text-sm font-mono font-semibold uppercase tracking-wider ' +
  'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:opacity-50 disabled:pointer-events-none';

// The same shape, quieter: for the secondary choice (Continue with Google).
export const PILL_OUTLINE =
  'h-11 px-6 rounded-full inline-flex items-center justify-center gap-2 text-sm font-mono font-semibold ' +
  'border border-border bg-transparent text-foreground hover:bg-secondary transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:opacity-50 disabled:pointer-events-none';
