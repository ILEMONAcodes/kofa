import type { Config } from "tailwindcss";
const color = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: color("primary"),
          hover: color("primary-hover"),
          tint: color("primary-tint"),
        },
        accent: color("accent"),
        canvas: color("canvas"),
        surface: color("surface"),
        ink: color("ink"),
        muted: color("muted"),
        border: color("border"),
        "input-border": color("input-border"),
        success: color("success"),
        warning: color("warning"),
        danger: color("danger"),
        inverse: color("inverse"),
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "Arial", "sans-serif"],
        editorial: ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-shell)",
      },
      maxWidth: { editorial: "86rem", workspace: "75rem" },
      boxShadow: {
        card: "0 2px 12px rgb(var(--ink) / 0.06)",
        panel: "0 12px 32px rgb(var(--ink) / 0.14)",
      },
    },
  },
  plugins: [],
} satisfies Config;
