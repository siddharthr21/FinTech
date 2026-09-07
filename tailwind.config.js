/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        terminal: {
          bg: "#080b11",
          card: "#0e131f",
          "card-elevated": "#131928",
          subcard: "#090d15",
          border: "#1d2538",
          "border-subtle": "#151b2a",
          muted: "#64748b",
          dim: "#94a3b8",
        },
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        terminal: "0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        "terminal-sm": "0 2px 8px -1px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)",
      },
    },
  },
  plugins: [],
};
