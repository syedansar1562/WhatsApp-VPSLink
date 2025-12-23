import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0a0a',
          surface: '#1a1a1a',
          elevated: '#2d2d2d',
          hover: '#3a3a3a',
          border: '#404040',
          'border-focus': '#525252',
        },
        text: {
          primary: '#ffffff',
          secondary: '#a3a3a3',
          tertiary: '#737373',
        },
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'blue-glow': '0 4px 12px rgba(59, 130, 246, 0.4)',
        'blue-glow-lg': '0 8px 16px rgba(59, 130, 246, 0.5)',
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease',
        slideUp: 'slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [],
}

export default config
