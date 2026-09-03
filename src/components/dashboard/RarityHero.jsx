import { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getDisplayRarity, RARITY_HEX, RARITY_ORDER } from '@/lib/rarityConsensus';

export default function RarityHero({ collected, sharedCansMap = {} }) {
  // Recharts sizes percentage-based innerRadius/outerRadius off a generic
  // min(width,height)/2 rule that has no idea our Pie's cy sits at the
  // bottom edge (cy="100%") with only the top half in use — so "100%"
  // caps out at roughly HALF the height we actually have room for, no
  // matter what percentage is requested. Measuring the box ourselves and
  // passing real pixel radii is the only way around that.
  const wrapperRef = useRef(null);
  const [size, setSize] = useState({ width: 330, height: 165 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 78% of the box height for the ring's outer edge — leaves headroom for
  // the on-arc labels (which sit further out still) without touching the
  // container's top or side edges.
  const outerRadius = size.height * 0.78;
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
    const color = RARITY_HEX[name] || '#6B7280';
    const pathRadius = (innerRadius + outerRadius) / 2;
    const strokeWidth = outerRadius - innerRadius;
    const labelRadius = outerRadius + 16;
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

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Rarity Breakdown
      </p>

      <div ref={wrapperRef} className="relative w-full max-w-[330px] mx-auto mt-2" style={{ aspectRatio: '2 / 1' }}>
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
                  fill={isEmpty ? '#3F3F46' : (RARITY_HEX[entry.name] || '#6B7280')}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1">
          <p className="text-4xl font-mono font-black text-foreground leading-none">
            {totalCans}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
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
                style={{ backgroundColor: RARITY_HEX[name] }}
              />
              <span className="text-xs font-mono text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
