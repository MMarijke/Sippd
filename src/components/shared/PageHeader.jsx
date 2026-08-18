export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-4">
      <div>
        <h1 className="text-xl font-display font-bold text-foreground tracking-wide">{title}</h1>
        {subtitle && <p className="text-xs font-mono text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}