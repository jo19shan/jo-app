/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'

  ],
  theme: {
    extend: {
  colors: {
    midnight: '#0f0f18',
    'moon-purple': '#1e0337',
    'sunrise-pink': '#e33d89',
  },
  backgroundImage: {
    'moon-earth': 'linear-gradient(135deg, #1e0337 0%, #0f0f18 100%)',
  },
}
  },
  plugins: []
}