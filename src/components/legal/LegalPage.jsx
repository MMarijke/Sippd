import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

// Flattens a react-markdown children tree to plain text, just enough to
// detect a "[NEEDS REVIEW — ...]" or "[TODO ...]" marker so it can be
// styled as a visible callout instead of reading as finished legal copy.
// The docs/*.md source files use both bracket conventions to flag content
// that still needs real review/legal input before publishing — this only
// makes that existing convention visible on the live page, it doesn't
// invent new markup in the source markdown itself. Widened to also match
// "[TODO" after a legal-content pass introduced that phrasing alongside
// the original "[NEEDS REVIEW" one; a marker in either form was rendering
// as plain, unflagged body text before this.
function flattenText(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (node?.props?.children) return flattenText(node.props.children);
  return '';
}

function isNeedsReview(children) {
  return /^\[(NEEDS REVIEW|TODO)/i.test(flattenText(children).trim());
}

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-display font-bold text-foreground tracking-wide mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-display font-semibold text-foreground mt-8 mb-3 pb-2 border-b border-border">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-display font-semibold text-foreground mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }) => {
    if (isNeedsReview(children)) {
      return (
        <div className="flex items-start gap-2.5 rounded-xl border border-caution/30 bg-caution/5 px-3 py-2.5 my-3">
          <AlertTriangle className="w-4 h-4 text-caution flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-mono text-caution leading-relaxed">{children}</p>
        </div>
      );
    }
    return <p className="text-sm font-body text-foreground leading-relaxed mb-3">{children}</p>;
  },
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2 hover:text-primary/80">{children}</a>
  ),
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1.5 mb-3 text-sm font-body text-foreground">{children}</ul>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="border-border my-6" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-xl border border-border">
      <table className="w-full text-xs font-body">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left font-mono uppercase tracking-wider text-muted-foreground text-2xs px-3 py-2 border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2.5 border-b border-border/50 text-foreground align-top">{children}</td>,
};

export default function LegalPage({ title, markdown }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center border border-border flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        {/* Not an h1: the document's own "# Title" is the page heading, and
            two h1s announced the title twice. */}
        <p className="text-base font-display font-bold text-foreground tracking-wide">{title}</p>
      </div>

      <div className={cn('px-5 pt-6 max-w-2xl mx-auto')}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
