/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom colors for the application
        'gold': {
          '50': '#fefce8',
          '100': '#fef9c3',
          '200': '#fef08a',
          '300': '#fde047',
          '400': '#facc15',
          '500': '#eab308',
          '600': '#ca8a04',
          '700': '#a16207',
          '800': '#854d0e',
          '900': '#713f12',
          '950': '#422006',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};