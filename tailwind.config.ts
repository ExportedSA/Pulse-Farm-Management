import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: '.5625rem',
  			md: '.375rem',
  			sm: '.1875rem'
  		},
  		colors: {
  			background: 'hsl(var(--background) / <alpha-value>)',
  			foreground: 'hsl(var(--foreground) / <alpha-value>)',
  			border: 'hsl(var(--border) / <alpha-value>)',
  			input: 'hsl(var(--input) / <alpha-value>)',
  			card: {
  				DEFAULT: 'hsl(var(--card) / <alpha-value>)',
  				foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
  				border: 'hsl(var(--card-border) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
  				foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
  				border: 'hsl(var(--popover-border) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
  				foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
  				border: 'var(--primary-border)'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
  				foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
  				border: 'var(--secondary-border)'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
  				foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
  				border: 'var(--muted-border)'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
  				foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
  				border: 'var(--accent-border)'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
  				foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
  				border: 'var(--destructive-border)'
  			},
  			ring: 'hsl(var(--ring) / <alpha-value>)',
  			chart: {
  				'1': 'hsl(var(--chart-1) / <alpha-value>)',
  				'2': 'hsl(var(--chart-2) / <alpha-value>)',
  				'3': 'hsl(var(--chart-3) / <alpha-value>)',
  				'4': 'hsl(var(--chart-4) / <alpha-value>)',
  				'5': 'hsl(var(--chart-5) / <alpha-value>)'
  			},
  			sidebar: {
  				ring: 'hsl(var(--sidebar-ring))',
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))'
  			},
  			'sidebar-primary': {
  				DEFAULT: 'hsl(var(--sidebar-primary) / <alpha-value>)',
  				foreground: 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
  				border: 'var(--sidebar-primary-border)'
  			},
  			'sidebar-accent': {
  				DEFAULT: 'hsl(var(--sidebar-accent) / <alpha-value>)',
  				foreground: 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
  				border: 'var(--sidebar-accent-border)'
  			},
  			status: {
  				online: 'rgb(34 197 94)',
  				away: 'rgb(245 158 11)',
  				busy: 'rgb(239 68 68)',
  				offline: 'rgb(156 163 175)'
  			},
  			pulse: {
				// Cream/Dark Green Theme
				// Cream backgrounds
				50: '#faf8f5',   // Main cream background
				100: '#f5f2ed',  // Slightly darker cream
				150: '#f0ebe4',  // Light beige hover
				200: '#e8e4de',  // Warm gray borders
				// Mid tones
				300: '#d4cfc6',
				400: '#a8a196',
				500: '#6b6459',
				// Dark greens (primary brand color)
				600: '#2d4a35',
				700: '#243d2c',
				800: '#1a3a2f',  // Main dark green text/active
				900: '#162b24',
				950: '#0f1f1a',
				// Named colors for semantic use
				cream: '#faf8f5',
				'cream-hover': '#f0ebe4',
				forest: '#1a3a2f',
				'forest-light': '#2d4a35',
				'forest-dark': '#162620',
				border: '#e8e4de',
				// Gold/tan accent colors
				gold: '#b8963e',
				'gold-light': '#c9a854',
				'gold-dark': '#9a7d33',
				brown: '#8b7355',
				tan: '#a89078',
				// Accent (using gold as accent)
				accent: '#b8963e',
				'accent-hover': '#c9a854',
				// Text colors
				'text-primary': '#1a3a2f',
				'text-secondary': '#2d4a35',
				'text-muted': '#6b6459',
				'text-light': '#ffffff'
			}
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)'
  			],
  			serif: [
  				'var(--font-serif)'
  			],
  			mono: [
  				'var(--font-mono)'
  			]
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
