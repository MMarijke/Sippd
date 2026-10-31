import { useEffect, useId, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getDisplayRarity, RARITY_ORDER, BREAKDOWN_VAR, breakdownBackground } from '@/lib/rarityConsensus';

// This gauge shows a PROPORTION across tiers (like CollectionCard's
// breakdown bar), not any single can's own badge color, so it reads the
// --breakdown-* ramp via BREAKDOWN_VAR directly. (Badges read --rarity-*,
// which mirror the same ramp; RARITY_HEX is a fixed fallback for contexts
// that can't read CSS custom properties.)
// CSS custom properties resolve fine as literal SVG fill/style values in
// every browser this app targets (this file's own empty-state ring already
// relied on that via hsl(var(--secondary)) before this change).
const breakdownColor = (name) => `hsl(var(${BREAKDOWN_VAR[name] || BREAKDOWN_VAR.Common}))`;

// Holo Legendary (Alloy family): the Legendary arc and its end cap fill
// with an SVG gradient whose stops read --holo-1..4. Every other theme
// leaves those unset, so each stop falls back to --breakdown-legendary and
// the arc renders as the same solid colour as before.
const HOLO_STOPS = [0, 0.35, 0.65, 1].map((offset, i) => ({
  offset,
  color: `hsl(var(--holo-${i + 1}, var(--breakdown-legendary)))`,
}));

export default function RarityHero({ collected, sharedCansMap = {}, isLoading = false }) {
  // Recharts sizes percentage-based innerRadius/outerRadius off a generic
  // min(width,height)/2 rule that has no idea our Pie's cy sits at the
  // bottom edge (cy="100%") with only the top half in use — so "100%"
  // caps out at roughly HALF the height we actually have room for, no
  // matter what percentage is requested. Measuring the box ourselves and
  // passing real pixel radii is the only way around that.
  const wrapperRef = useRef(null);
  const holoId = `rarity-holo-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const arcFill = (name) => (name === 'Legendary' ? `url(#${holoId})` : breakdownColor(name));
  const [size, setSize] = useState({ width: 330, height: 165 });

  // Re-attached when loading ends: the loading skeleton has no wrapperRef,
  // so attaching only on mount (as before) never measured anything when the
  // gauge mounted mid-load, and the default size stuck. That happened to
  // match the 330px box, but not a narrower one (a 320px screen), where the
  // ring was drawn bigger than its box and clipped its count labels.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]);

  if (isLoading) {
    return (
      <div>
        <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground text-center">
          Rarity Breakdown
        </p>
        <div className="relative w-full max-w-[330px] mx-auto mt-2 flex items-end justify-center" style={{ aspectRatio: '2 / 1' }}>
          <div className="w-3/4 h-3/4 rounded-t-full bg-secondary/60 animate-pulse" />
        </div>
      </div>
    );
  }

  // The ring's outer edge, leaving headroom for the on-arc count labels
  // (which sit further out still): capped by height AND by width, since at
  // 320px the 78%-of-height ring pushed two labels outside the SVG.
  const labelGap = 16;
  const outerRadius = Math.min(size.height * 0.78, size.width / 2 - labelGap - 8);
  const innerRadius = outerRadius * 0.82;

  const rarityCounts = {};
  collected.forEach(item => {
    const sharedCan = sharedCansMap[item.can_id];
    const r = sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common');
    rarityCounts[r] = (rarityCounts[r] || 0) + 1;
  });

  const tiers = RARITY_ORDER
    .filter(name => rarityCounts[name] > 0)
    .map(name => ({ name, value: rarityCounts[name] }));

  const totalCans = collected.length;
  const isEmpty = totalCans === 0;

  const data = isEmpty ? [{ name: 'Empty', value: 1 }] : tiers;

  // Count label + rounded end caps, drawn from inside the Pie's own label
  // callback because that's the only place recharts hands over the real
  // computed pixel geometry (cx/cy) to pair with our own measured radii.
  const renderArcLabel = (props) => {
    if (isEmpty) return null;
    const { cx, cy, midAngle, value, index, name } = props;
    const RADIAN = Math.PI / 180;
    const color = arcFill(name);
    const pathRadius = (innerRadius + outerRadius) / 2;
    const strokeWidth = outerRadius - innerRadius;
    const labelRadius = outerRadius + labelGap;
    const lx = cx + labelRadius * Math.cos(-midAngle * RADIAN);
    const ly = cy + labelRadius * Math.sin(-midAngle * RADIAN);

    const caps = [];
    if (index === 0) {
      const sx = cx + pathRadius * Math.cos(-180 * RADIAN);
      const sy = cy + pathRadius * Math.sin(-180 * RADIAN);
      caps.push(<circle key="cap-start" cx={sx} cy={sy} r={strokeWidth / 2} fill={color} />);
    }
    if (index === data.length - 1) {
      const ex = cx + pathRadius * Math.cos(0);
      const ey = cy + pathRadius * Math.sin(0);
      caps.push(<circle key="cap-end" cx={ex} cy={ey} r={strokeWidth / 2} fill={color} />);
    }

    return (
      <g key={`arc-label-${name}`}>
        {caps}
        <text
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}
        >
          {value}
        </text>
      </g>
    );
  };

  // What a screen reader hears instead of the chart: it used to read the
  // bare arc counts ("5 3 3 1 1") with no tier names, after landing on an
  // unlabelled focusable node recharts adds to the pie.
  const summary = isEmpty
    ? 'Rarity breakdown: no cans yet'
    : `Rarity breakdown: ${totalCans} ${totalCans === 1 ? 'can' : 'cans'}, ${tiers.map(t => `${t.value} ${t.name}`).join(', ')}`;

  return (
    <div>
      <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground text-center" aria-hidden="true">
        Rarity Breakdown
      </p>

      {/* role="img" + label: one spoken summary; everything inside (arcs,
          counts, the total) is presentational. */}
      <div ref={wrapperRef} role="img" aria-label={summary} className="relative w-full max-w-[330px] mx-auto mt-2" style={{ aspectRatio: '2 / 1' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <linearGradient id={holoId} x1="0" y1="0" x2="1" y2="1">
                {HOLO_STOPS.map(s => (
                  <stop key={s.offset} offset={s.offset} style={{ stopColor: s.color }} />
                ))}
              </linearGradient>
            </defs>
            <Pie
              rootTabIndex={-1}
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
              label={renderArcLabel}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  // Empty-state ring reads from --secondary (a themed UI-chrome
                  // token, reskinned per theme via [data-theme] on <html>) rather
                  // than a literal hex — unlike RARITY_HEX below, this color has
                  // no product meaning tied to a specific rarity tier, so it
                  // should track the active theme like the rest of the app's
                  // neutral surfaces.
                  fill={isEmpty ? 'hsl(var(--secondary))' : arcFill(entry.name)}
                  // Pale or deep tiers keep their shape on their card
                  // (--gauge-edge; transparent where the tiers already read).
                  style={isEmpty ? undefined : { stroke: 'var(--gauge-edge)', strokeWidth: 1 }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1">
          <p className="text-4xl font-num font-black text-foreground leading-none tabular-nums">
            {totalCans}
          </p>
          <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground mt-1">
            cans
          </p>
        </div>
      </div>

      {!isEmpty && (
        // The key: one equal column per tier the collection has, dot above
        // name, so it's always a single row under the arc. It was an inline
        // wrapping row of mono labels that left Legendary alone on a second
        // line in every theme: five names don't fit one 320-350px line at
        // the 11px floor in the wider monos (Martian, Azeret). Names are in
        // the body face, so even "Legendary" fits its column on a 360px phone.
        <div
          className="grid gap-1 mt-5"
          style={{ gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {tiers.map(({ name }) => (
            <div key={name} className="flex flex-col items-center gap-1 min-w-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 gauge-seg"
                style={{ background: breakdownBackground(name) }}
              />
              <span className="text-2xs font-body font-medium text-muted-foreground text-center leading-tight">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
