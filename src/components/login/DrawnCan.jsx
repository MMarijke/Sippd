import { useId } from 'react';

// Drawn, unbranded cans for the signed-out sign-up page: they show at a
// glance that Sippd is about cans without featuring a real brand's pack
// shot (catalog photos are brand-owned, and only readable once signed in).
// Every name on them is made up. Decorative, so aria-hidden: whatever they
// show is also said in text nearby.

// Body shading, dark edge -> lit -> highlight -> mid -> dark edge.
export const CAN_PALETTES = {
  legendary: ['#4a004a', '#ff33ff', '#ff66ff', '#b000b0', '#2a002a'],
  ultra: ['#2a0a4f', '#a855f7', '#c79bff', '#7a2fd0', '#1a0633'],
  rare: ['#0b2350', '#3b82f6', '#8db8ff', '#2160c8', '#071735'],
  uncommon: ['#063d1f', '#22c55e', '#86efac', '#15913f', '#042a15'],
  common: ['#2a2d33', '#8b919c', '#d3d7de', '#646a75', '#1b1d21'],
};

export default function DrawnCan({ className, palette = CAN_PALETTES.legendary, word = 'NOVA', sub = 'SURGE XL' }) {
  const id = useId().replace(/:/g, '');
  const body = `can-body-${id}`;
  const metal = `can-metal-${id}`;
  const shine = `can-shine-${id}`;

  return (
    <svg viewBox="0 0 80 168" className={className} aria-hidden="true" focusable="false">
      <defs>
        {/* Horizontal shading reads as a cylinder: dark edges, lit centre-left. */}
        <linearGradient id={body} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={palette[0]} />
          <stop offset="0.28" stopColor={palette[1]} />
          <stop offset="0.42" stopColor={palette[2]} />
          <stop offset="0.7" stopColor={palette[3]} />
          <stop offset="1" stopColor={palette[4]} />
        </linearGradient>
        <linearGradient id={metal} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5b5b66" />
          <stop offset="0.35" stopColor="#f2f2f7" />
          <stop offset="0.65" stopColor="#a9a9b4" />
          <stop offset="1" stopColor="#44444d" />
        </linearGradient>
        <linearGradient id={shine} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Body: tapered shoulder at the top, rounded base. */}
      <path
        d="M17 16 C13 20 9 24 9 30 L9 148 C9 156 12 160 16 161 L64 161 C68 160 71 156 71 148 L71 30 C71 24 67 20 63 16 Z"
        fill={`url(#${body})`}
      />
      {/* Lid rim and lid. */}
      <path d="M15 16 C15 11 65 11 65 16 L63 19 C63 15 17 15 17 19 Z" fill={`url(#${metal})`} />
      <ellipse cx="40" cy="15" rx="24" ry="4.2" fill={`url(#${metal})`} />
      <ellipse cx="40" cy="15.4" rx="19" ry="2.8" fill="#8d8d98" />
      {/* Pull tab. */}
      <rect x="35" y="12.6" width="10" height="4.4" rx="2.2" fill="#d9d9e0" stroke="#6f6f7a" strokeWidth="0.6" />
      <circle cx="42.4" cy="14.8" r="1.1" fill="#6f6f7a" />
      {/* Base rim. */}
      <path d="M16 161 L64 161 C63 165 17 165 16 161 Z" fill={`url(#${metal})`} />

      {/* Label: a made-up name, set vertically like a real can's wordmark. */}
      <g transform="translate(43 89) rotate(-90)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill="#ffffff"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 21, letterSpacing: 1.5 }}
        >
          {word}
        </text>
        <text
          x="0"
          y="13"
          textAnchor="middle"
          fill="#ffe0ff"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 8.5, letterSpacing: 2.4 }}
        >
          {sub}
        </text>
      </g>

      {/* Specular highlight down the lit side. */}
      <rect x="20" y="24" width="7" height="132" rx="3.5" fill={`url(#${shine})`} />
    </svg>
  );
}
