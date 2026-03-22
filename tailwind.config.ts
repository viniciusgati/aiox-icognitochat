import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surface scale — zinc-based (neutral, no blue tint)
        surface: {
          '950': '#09090b',
          '900': '#111113',
          '800': '#18181b',
          '700': '#27272a',
          '600': '#3f3f46',
          '500': '#52525b',
          '400': '#71717a',
          '300': '#a1a1aa',
          '200': '#d4d4d8',
          '100': '#f4f4f5',
        },
        // Brand accent — indigo/violet
        brand: {
          '400': '#818cf8',
          '500': '#6366f1',
          '600': '#4f46e5',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(99,102,241,0.18)',
        'glow': '0 0 24px rgba(99,102,241,0.22)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)',
        'modal': '0 25px 50px rgba(0,0,0,0.7)',
      },
      backgroundImage: {
        'bubble-own': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'bubble-own-hover': 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
    },
  },
  plugins: [],
}
export default config
