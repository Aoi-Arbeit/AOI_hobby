/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1a1d2e',
        panel:   '#222538',
        border:  '#2e3354',
        up:      '#26a69a',
        down:    '#ef5350',
      },
    },
  },
  plugins: [],
}
