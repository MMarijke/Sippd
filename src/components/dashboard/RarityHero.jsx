import { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getDisplayRarity, RARITY_ORDER, BREAKDOWN_VAR } from '@/lib/rarityConsensus';

// This gauge shows a PROPORTION across tiers (like CollectionCard's
// breakdown bar), not any single can's own badge color, so it reads the
// theme-aware --breakdown-* ramp via BREAKDOWN_VAR rather than RARITY_HEX/
// --rarity-*, which stay fixed on purpose for an individual can's rarity.
// CSS custom properties resolve fine as literal SVG fill/style values in
// every browser this app targets (this file's own empty-state ring already
// relied on that via hsl(var(--secondary)) before this change).
const breakdownColor = (name) => `hsl(var(${BREAKDOWN_VAR[name] || BREAKDOWN_VAR.Common}))`;

// compact: the smaller gauge Home shows under your standing and your cans,
// where it supports rather than leads (/impeccable layout).
export default function RarityHero({ collected, sharedCansMap = {}, isLoading = false, compact = false }) {
  const boxWidth = compact ? 'max-w-[220px]' : 'max-w-[330px]';
  // Recharts sizes percentage-based innerRadius/outerRadius off a generic
  // min(width,height)/2 rule that has no idea our Pie's cy sits at the
  // bottom edge (cy="100%") with only the top half in use — so "100%"
  // caps out at roughly HALF the height we actually have room for, no
  // matter what percentage is requested. Measuring the box ourselves and
  // passing real pixel radii is the only way around that.
  const wrapperRef = useRef(null);
  const [size, setSize] = useState(() => (compact ? { width: 220, height: 110 } : { width: 330, height: 165 }));

  // Re-attached when loading ends: the loading skeleton has no wrapperRef,
  // so attaching only on mount (as before) never measured anything when the
  // gauge mounted mid-load, and the default size stuck. That happened to
  // match the old 330px box; the compact one drew a ring far bigger than
  // its box, clipping it and its count labels.
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
        <div className={`relative w-full ${boxWidth} mx-auto mt-2 flex items-end justify-center`} style={{ aspectRatio: '2 / 1' }}>
          <div className="w-3/4 h-3/4 rounded-t-full bg-secondary/60 animate-pulse" />
        </div>
      </div>
    );
  }

  // The ring's outer edge, leaving headroom for the on-arc count labels
  // (which sit further out still): capped by height AND by width, since at
  // 320px the 78%-of-height ring pushed two labels outside the SVG.
  const labelGap = compact ? 11 : 16;
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
    const color = breakdownColor(name);
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
          style={{ fill: 'hsl(var(--foreground))', fontSize: compact ? 11 : 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}
        >
          {value}
        </text>
      </g>
    );
  };

  return (
    <div>
      <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground text-center">
        Rarity Breakdown
      </p>

      <div ref={wrapperRef} className={`relative w-full ${boxWidth} mx-auto mt-2`} style={{ aspectRatio: '2 / 1' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
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
                  fill={isEmpty ? 'hsl(var(--secondary))' : breakdownColor(entry.name)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1">
          <p className={`${compact ? 'text-2xl' : 'text-4xl'} font-mono font-black text-foreground leading-none`}>
            {totalCans}
          </p>
          <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground mt-1">
            cans
          </p>
        </div>
      </div>

      {!isEmpty && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
          {tiers.map(({ name }) => (
            <div key={name} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: breakdownColor(name) }}
              />
              <span className="text-xs font-mono text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
