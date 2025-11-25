const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        sand: '#EAD1BA',
        pine: '#3A7344',
        charcoal: '#332F28',
        slate: '#535353',
        fog: '#BFBFBF',
        clay: '#997A63',
        alabaster: '#FFFFFF',
        'pine-dark': '#2C5834',
      },
      fontFamily: {
        sans: ['"Inter"', ...defaultTheme.fontFamily.sans],
        display: ['"Playfair Display"', ...defaultTheme.fontFamily.serif],
      },
      boxShadow: {
        brand: '0 25px 65px -30px rgba(51, 47, 40, 0.8)',
        raised: '0 18px 30px -15px rgba(58, 115, 68, 0.45)',
      },
      backgroundImage: {
        'login-hero':
          'radial-gradient(circle at top left, rgba(58, 115, 68, 0.35), transparent 55%), radial-gradient(circle at bottom right, rgba(153, 122, 99, 0.4), transparent 50%)',
      },
      borderRadius: {
        brand: '2.5rem',
      },
      transitionTimingFunction: {
        'cursor-fluid': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

