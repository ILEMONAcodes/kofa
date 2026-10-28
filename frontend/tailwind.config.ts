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
      fontSize: {
        "home-caption": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "home-card": ["20px", { lineHeight: "28px", fontWeight: "500" }],
        "home-title": ["24px", { lineHeight: "32px", fontWeight: "500" }],
        "home-section": ["48px", { lineHeight: "54px", fontWeight: "500" }],
        "home-serif": ["64px", { lineHeight: "66px", fontWeight: "400" }],
        "home-wordmark": [
          "194px",
          { lineHeight: "200px", fontWeight: "500", letterSpacing: "-8px" },
        ],
        "home-footer-wordmark": [
          "168px",
          { lineHeight: "174px", fontWeight: "500" },
        ],
      },
      fontFamily: {
        sans: [
          "var(--font-dm-sans)",

          "Arial",
          "sans-serif",
        ],
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
