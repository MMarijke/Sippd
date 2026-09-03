import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getDisplayRarity, RARITY_HEX, RARITY_ORDER } from '@/lib/rarityConsensus';

export default function RarityHero({ collected, sharedCansMap = {} }) {
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

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Rarity Breakdown
      </p>

      <div className="relative w-full max-w-[330px] mx-auto mt-2" style={{ aspectRatio: '2 / 1' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
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
          {tiers.map(({ name, value }) => (
            <div key={name} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: RARITY_HEX[name] }}
              />
              <span className="text-xs font-mono text-muted-foreground">{name}</span>
              <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
