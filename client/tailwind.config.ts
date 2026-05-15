import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brilliant.org-inspired dark palette. Token names are kept from the
        // original warm palette so existing classes (`bg-cream-50`, `text-ink-950`)
        // continue working — only the values are inverted for deep navy dark mode.
        cream: {
          50:  "#070C1A", // deepest — page background
          100: "#0F1A33", // panels / cards
          200: "#1A2A4D", // borders / dividers
          300: "#243766", // raised borders / hover
        },
        ink: {
          950: "#FFFFFF",
          900: "#F1F5FB",
          800: "#D5DEEC",
          700: "#A4B3CC", // secondary text
          600: "#7C8DA8",
          500: "#5E7090", // quiet / placeholder
          400: "#42547A",
          300: "#2C3E60",
        },
        clay: {
          DEFAULT: "#22D3EE", // brilliant cyan accent
          soft:    "#67E8F9",
          dark:    "#0891B2",
        },
        good: "#34D399",
        bad:  "#F87171",
        gold: "#FACC15",
        violet: "#A78BFA",
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Source Serif 4"', '"Lora"', "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.45), 0 12px 32px -12px rgba(0,0,0,0.55)",
        ring: "0 0 0 1px rgba(34,211,238,0.45), 0 14px 40px -10px rgba(34,211,238,0.45)",
        glow: "0 0 32px -4px rgba(34,211,238,0.55)",
      },
      borderRadius: {
        "2xl": "1.1rem",
        "3xl": "1.6rem",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
