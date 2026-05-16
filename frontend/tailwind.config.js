/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Navy blue from "MEGH AGRO EQUIPMENT" logo text
        brand: {
          50:  '#eef2fb',
          100: '#d5dff5',
          200: '#aabfeb',
          300: '#7898de',
          400: '#4e72cf',
          500: '#2d52b8',
          600: '#1e3d9e',
          700: '#163082',
          800: '#102468',
          900: '#0d1e56',   // deepest navy — sidebar bg
          950: '#080f30',
        },
        // Red from the "Megh" circular logo mark
        accent: {
          50:  '#fff1f1',
          100: '#ffd9d9',
          200: '#ffb3b3',
          300: '#ff7a7a',
          400: '#f94545',
          500: '#e31b1b',   // primary red
          600: '#c41414',
          700: '#a30f0f',
          800: '#870d0d',
          900: '#6f0e0e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
