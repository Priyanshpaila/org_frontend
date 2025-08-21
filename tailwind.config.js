/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#dfeeff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        }
      }
    },
  },
  plugins: [],
}
