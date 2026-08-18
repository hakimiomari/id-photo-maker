import type { Config } from "tailwindcss";

/**
 * Design tokens (spec §8.2): a "documents" product — calm neutrals, one deep
 * blue accent, semantic colours reserved for validation state. Text colours
 * hold WCAG AA on their intended surfaces: ink.muted ≥ 7:1 and ink.faint
 * ≥ 4.5:1 on white; the *.strong pairs ≥ 4.5:1 on their soft backgrounds.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F6F8",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#131A22",
          muted: "#49545F",
          faint: "#6E7A87",
        },
        line: {
          DEFAULT: "#E5E8EE",
          strong: "#D2D8E1",
        },
        accent: {
          DEFAULT: "#1D4ED8",
          hover: "#1941B8",
          soft: "#EEF3FE",
          border: "#B9CCF4",
        },
        ok: { DEFAULT: "#067647", soft: "#E9F6EF", border: "#B5E2CB" },
        warn: { DEFAULT: "#8A5A00", soft: "#FCF3E1", border: "#EED9A8" },
        danger: { DEFAULT: "#B3261E", soft: "#FCEDEB", border: "#F2C4C0" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        control: "10px",
      },
      boxShadow: {
        // Two-layer shadows: a tight contact line plus a soft ambient falloff.
        card: "0 1px 2px rgba(15, 23, 42, 0.05), 0 8px 24px -8px rgba(15, 23, 42, 0.08)",
        lift: "0 2px 4px rgba(15, 23, 42, 0.06), 0 16px 32px -12px rgba(15, 23, 42, 0.14)",
        thumb:
          "0 1px 2px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.04)",
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
