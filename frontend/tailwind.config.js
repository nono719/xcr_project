/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#1677ff', 600: '#0958d9' },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.08)',
        elevated: '0 12px 40px rgba(22,119,255,0.18)',
      },
    },
  },
  plugins: [],
};
