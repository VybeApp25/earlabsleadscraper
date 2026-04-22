/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0eaff",
          400: "#6b8eff",
          500: "#4f6ef7",
          600: "#3b58e8",
          700: "#2d44cc",
          900: "#1a2a8a",
        },
        surface: {
          900: "var(--surface-900)",
          800: "var(--surface-800)",
          700: "var(--surface-700)",
          600: "var(--surface-600)",
          500: "var(--surface-500)",
        },
      },
      animation: {
        "pulse-new": "pulse-new 2s ease-in-out 3",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
      keyframes: {
        "pulse-new": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(74, 222, 128, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(74, 222, 128, 0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
