/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        resq: {
          bg: '#06150C',
          panel: '#0A2416',
          panelLight: '#0f3320',
          border: '#249344',
          borderDim: '#16572a',
          accent: '#BDFF42',
          text: '#FFFFFF',
          textDim: '#9FD8A8',
          amber: '#FFA31A',
          riskLow: '#10B981',
          riskMod: '#F59E0B',
          riskHigh: '#F97316',
          riskCrit: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace']
      }
    },
  },
  plugins: [],
}
