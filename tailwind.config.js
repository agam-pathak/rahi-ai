/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rahi: {
          bg: "var(--rahi-bg)",
          "bg-2": "var(--rahi-bg-2)",
          surface: "var(--rahi-surface)",
          "surface-strong": "var(--rahi-surface-strong)",
          border: "var(--rahi-border)",
          accent: "var(--rahi-accent)",
          "accent-2": "var(--rahi-accent-2)",
          text: "var(--rahi-text)",
          muted: "var(--rahi-muted)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
      boxShadow: {
        premium: "0 20px 60px rgba(2, 6, 23, 0.45)",
        glow: "0 0 24px rgba(20, 184, 166, 0.35)",
      },
      borderRadius: {
        xl: "var(--rahi-radius-lg)",
        lg: "var(--rahi-radius-md)",
        md: "var(--rahi-radius-sm)",
      },
      backgroundImage: {
        "premium-radial":
          "radial-gradient(circle at top, rgba(20, 184, 166, 0.18), transparent 55%)",
      },
    },
  },
  plugins: [],
}
