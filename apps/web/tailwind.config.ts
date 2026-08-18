import type { Config } from "tailwindcss";

/**
 * Design tokens (spec §8.2), themed via CSS variables: the palette lives in
 * globals.css as RGB triplets on :root (light) and .dark, so every component
 * adapts without per-element dark: variants. The <alpha-value> plumbing keeps
 * Tailwind's opacity modifiers (bg-surface/90 etc.) working.
 *
 * Text contrast holds WCAG AA on intended surfaces in both themes; anything
 * that sits on an accent/semantic fill uses text-surface, which resolves to
 * white in light mode and near-black in dark mode.
 */
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "selector",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        /** The crop area behind the photo — stays neutral grey in both themes
         *  so photo colours read correctly (§8.2). */
        editor: token("editor"),
        ink: {
          DEFAULT: token("ink"),
          muted: token("ink-muted"),
          faint: token("ink-faint"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          soft: token("accent-soft"),
          border: token("accent-border"),
        },
        ok: {
          DEFAULT: token("ok"),
          soft: token("ok-soft"),
          border: token("ok-border"),
        },
        warn: {
          DEFAULT: token("warn"),
          soft: token("warn-soft"),
          border: token("warn-border"),
        },
        danger: {
          DEFAULT: token("danger"),
          soft: token("danger-soft"),
          border: token("danger-border"),
        },
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
