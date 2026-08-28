import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getDisplayRarity, RARITY_HEX as RARITY_COLORS } from '@/lib/rarityConsensus';

export default function RarityChart({ collection, sharedCansMap = {} }) {
  const rarityCounts = {};
  collection.forEach(item => {
    const sharedCan = sharedCansMap[item.can_id];
    const r = sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common');
    rarityCounts[r] = (rarityCounts[r] || 0) + 1;
  });

  const data = Object.entries(rarityCounts).map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-display font-semibold text-foreground mb-3">Rarity Breakdown</h3>
        <p className="text-xs text-muted-foreground font-mono">No cans yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-3 tracking-wide">
        Rarity Breakdown
      </h3>
      <div className="flex items-center gap-4">
        <div className="w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={45}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={RARITY_COLORS[entry.name] || '#6B7280'} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          {data.map(({ name, value }) => (
            <div key={name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: RARITY_COLORS[name] }}
                />
                <span className="text-xs font-mono text-muted-foreground">{name}</span>
              </div>
              <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}