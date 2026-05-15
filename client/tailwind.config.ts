import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Google Material 3 dark surface scale. Token names are kept from the
        // original palette ("cream", "ink", "clay") so existing class usage in
        // components keeps working — only the values shift to a flat, neutral
        // Google-style dark theme.
        cream: {
          50:  "#0e0e0e", // app background (near-black, no tint)
          100: "#1f1f1f", // surface 1 — primary panel
          200: "#2d2d2d", // hairline borders / dividers
          300: "#3c3c3c", // surface 2 — elevated / hover
        },
        ink: {
          950: "#e8eaed", // primary text
          900: "#dadce0",
          800: "#bdc1c6",
          700: "#9aa0a6", // secondary text
          600: "#80868b",
          500: "#5f6368", // tertiary / placeholder
          400: "#3c4043",
          300: "#202124",
        },
        clay: {
          DEFAULT: "#8ab4f8", // Google Material 3 primary (dark mode blue)
          soft:    "#aecbfa",
          dark:    "#669df6",
        },
        good: "#81c995", // Material green 200
        bad:  "#f28b82", // Material red 200
        gold: "#fdd663", // Material yellow 200
        violet: "#c58af9", // Material purple 200
      },
      fontFamily: {
        // Single typeface — Inter. The "serif" key still maps to Inter so all
        // existing `font-serif` usage keeps rendering correctly without a
        // codebase-wide find/replace.
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Material elevations — minimal, just enough to lift surfaces.
        soft: '0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)',
        ring: '0 0 0 1px rgba(138,180,248,0.4)',
        glow: '0 0 0 1px rgba(138,180,248,0.3)',
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
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
