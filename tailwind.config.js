/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Dela Gothic One"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        bg: '#111111',
        surface: '#1E1E1E',
        surface2: '#272727',
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.07)',
      },
    },
  },
  plugins: [],
}
