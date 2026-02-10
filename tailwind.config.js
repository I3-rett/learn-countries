/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d0f14',
        coal: '#1a1f2b',
        parchment: '#f5efe6',
        peach: '#ffb48a',
        ember: '#ff5c3c',
        jade: '#2bb673',
        lake: '#2b4d7a',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'Haettenschweiler', 'Arial Black', 'sans-serif'],
        body: ['"IBM Plex Sans"', '"Trebuchet MS"', 'Verdana', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

