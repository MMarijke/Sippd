/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			display: ['var(--font-display)'],
  			mono: ['var(--font-mono)'],
  			body: ['var(--font-body)'],
  		},
  		// The app's small-text floor: labels, metadata, badges. rem, not px,
  		// so it follows the user's own browser/OS text size. Font-size only
  		// (no paired line-height) to match the text-[Npx] values it replaced,
  		// which inherited line-height rather than setting one.
  		fontSize: {
  			'2xs': '0.6875rem',
  		},
  		// bg-primary paints --primary-fill, not --primary. They're the same
  		// colour in every theme (index.css defaults one to the other) except
  		// where a theme's exact colour is too pale to read as text: Spring's
  		// Butter, Pistachio and Coral fill buttons with the palette's exact
  		// hex, while text-primary/border/ring keep a deeper shade of it.
  		backgroundColor: {
  			primary: {
  				DEFAULT: 'hsl(var(--primary-fill))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  		},
  		// text-destructive paints --destructive-text: a per-tone shade of the
  		// error red that clears 4.5:1 as text in every theme (index.css).
  		// bg-/border-destructive keep the --destructive fill red.
  		textColor: {
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive-text))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  		},
  		// Every step scales with the family's --radius-scale (index.css):
  		// 0 is Noir's square corners, 1.75 Candy's round ones. rounded-full
  		// (pills, avatars) stays round everywhere.
  		borderRadius: {
  			DEFAULT: 'calc(0.25rem * var(--radius-scale, 1))',
  			sm: 'max(0px, calc(var(--radius) - 4px))',
  			md: 'max(0px, calc(var(--radius) - 2px))',
  			lg: 'var(--radius)',
  			xl: 'calc(0.75rem * var(--radius-scale, 1))',
  			'2xl': 'calc(1rem * var(--radius-scale, 1))',
  			'3xl': 'calc(1.5rem * var(--radius-scale, 1))'
  		},
  		// `border` (and border-b, divide-y...) draws the family's weight:
  		// 1px, or 1.5px for Candy/Spring/Soda Fountain.
  		borderWidth: {
  			DEFAULT: 'var(--border-width, 1px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			// Each theme's Uncommon colour (the rarity gauge's Uncommon
  			// step) as an action fill, with a per-theme text colour picked
  			// for contrast (src/lib/breakdownRamps.test.js guards >= 4.5:1).
  			// Scan and the selected brand chip. --cta defaults to the theme's
  			// own button fill (index.css), so the main action is never quieter
  			// than Save, and its label is the fill's already-checked label.
  			cta: {
  				DEFAULT: 'hsl(var(--cta))',
  				foreground: 'hsl(var(--cta-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			rarity: {
  				common: 'hsl(var(--rarity-common))',
  				uncommon: 'hsl(var(--rarity-uncommon))',
  				rare: 'hsl(var(--rarity-rare))',
  				ultra: 'hsl(var(--rarity-ultra))',
  				legendary: 'hsl(var(--rarity-legendary))',
  				'common-text': 'hsl(var(--rarity-common-text))',
  				'uncommon-text': 'hsl(var(--rarity-uncommon-text))',
  				'rare-text': 'hsl(var(--rarity-rare-text))',
  				'ultra-text': 'hsl(var(--rarity-ultra-text))',
  				'legendary-text': 'hsl(var(--rarity-legendary-text))',
  				// Label on a FILLED Legendary badge (RarityBadge).
  				'legendary-on': 'hsl(var(--rarity-legendary-on))',
  			},
  			medal: {
  				gold: 'hsl(var(--medal-gold))',
  				silver: 'hsl(var(--medal-silver))',
  				bronze: 'hsl(var(--medal-bronze))',
  			},
  			overlap: 'hsl(var(--overlap))',
  			caution: 'hsl(var(--caution))',
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			'pulse-neon': {
  				'0%, 100%': { opacity: '1' },
  				'50%': { opacity: '0.5' }
  			},
  			'shimmer': {
  				'0%': { transform: 'translateX(-100%)' },
  				'100%': { transform: 'translateX(100%)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
  			'shimmer': 'shimmer 2s infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
