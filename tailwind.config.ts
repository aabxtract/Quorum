import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        quorum: {
          50: '#e6fffa',
          100: '#b3fff0',
          200: '#80ffe5',
          300: '#4dffdb',
          400: '#1affd1',
          500: '#0cf2c4',
          600: '#00ccaa',
          700: '#009980',
          800: '#006655',
          900: '#00332b',
          950: '#001a15',
        },
        surface: {
          dark: '#0f0f11',
          panel: '#1a1a1c',
          card: '#222225',
          light: '#2a2a2e',
        }
      },
      fontFamily: {
        sans: ['var(--font-open-sans)', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        heading: ['var(--font-poppins)', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'text-shimmer': 'textShimmer 3s ease infinite alternate',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px 0px rgba(12, 242, 196, 0.3)' },
          '50%': { opacity: '.5', boxShadow: '0 0 10px 0px rgba(12, 242, 196, 0.1)' },
        },
        textShimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
