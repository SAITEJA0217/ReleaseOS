import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#06090e",
          900: "#0b0f17",
          850: "#0f1522",
          800: "#141c2c",
          700: "#1e293b",
        },
        slate: {
          850: "#172033",
          900: "#0f172a",
          950: "#020617",
        },
        accent: {
          blue: "#38bdf8",
          blueHover: "#0284c7",
          electric: "#60a5fa",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(56, 189, 248, 0.25)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
    },
  },
  plugins: [],
};

export default config;
