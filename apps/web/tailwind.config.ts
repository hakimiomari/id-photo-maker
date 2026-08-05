import type { Config } from "tailwindcss";

/**
 * Neutral, document-like palette (§8.2): near-white surfaces, one deep-blue
 * accent, semantic colours reserved for validation state.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#12161C",
          muted: "#5A6472",
          faint: "#8C94A1",
        },
        line: "#E3E7ED",
        accent: {
          DEFAULT: "#1D4ED8",
          hover: "#1A43BA",
          soft: "#EEF3FF",
        },
        ok: { DEFAULT: "#0F7A46", soft: "#E7F5ED" },
        warn: { DEFAULT: "#9A6400", soft: "#FDF3E2" },
        danger: { DEFAULT: "#B3261E", soft: "#FDECEA" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 16px rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
