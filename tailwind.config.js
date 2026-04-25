/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        wafg: {
          cyan: '#01ecf3',
          softcyan: '#54d1de',
          black: '#000000',
          white: '#ffffff',
          warmgray: '#f4f4f1',
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        script: ['Caveat', 'cursive'],
      },
      boxShadow: {
        sticker: '6px 6px 0 #000',
        'sticker-sm': '4px 4px 0 #000',
        'sticker-lg': '8px 8px 0 #000',
        'sticker-cyan': '6px 6px 0 #01ecf3',
      },
    },
  },
  plugins: [],
};
