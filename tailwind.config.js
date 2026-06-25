/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          dark: '#060113',
          surface: '#0b051e',
        },
        accent: {
          primary: '#ff8c00',
          secondary: '#ff0080',
        },
        text: {
          primary: '#ffffff',
          secondary: '#a0aec0',
          dim: '#718096',
        }
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(90deg, #ff8c00, #ff0080)',
      },
      fontFamily: {
        main: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
