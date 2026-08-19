/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#0f172a',
        'bg-card': 'rgba(30, 41, 59, 0.6)',
        'accent': '#3b82f6',
        'accent-glow': 'rgba(59, 130, 246, 0.4)',
        'accent-hover': '#2563eb',
        'success': '#10b981',
        'error': '#ef4444',
      }
    },
  },
  plugins: [],
}
