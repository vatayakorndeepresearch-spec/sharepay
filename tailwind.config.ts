import type { Config } from "tailwindcss";

/** Every colour is driven by a CSS variable so light/dark and future rebrands
 *  are a single change in app.css instead of a sed across every component. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],

  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: {
          DEFAULT: token("surface"),
          muted: token("surface-muted"),
          sunken: token("surface-sunken")
        },
        border: {
          DEFAULT: token("border"),
          strong: token("border-strong")
        },
        text: {
          DEFAULT: token("text")
        },
        soft: token("text-soft"),
        muted: token("text-muted"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          soft: token("accent-soft"),
          "on-soft": token("accent-on-soft")
        },
        income: {
          DEFAULT: token("income"),
          soft: token("income-soft"),
          "on-soft": token("income-on-soft")
        },
        pending: {
          DEFAULT: token("pending"),
          soft: token("pending-soft"),
          "on-soft": token("pending-on-soft")
        },
        danger: {
          DEFAULT: token("danger"),
          soft: token("danger-soft"),
          "on-soft": token("danger-on-soft")
        }
      },
      spacing: {
        nav: "var(--nav-h)",
        safe: "var(--safe-bottom)"
      },
      transitionDuration: {
        DEFAULT: "var(--motion-fast)"
      },
      transitionTimingFunction: {
        DEFAULT: "var(--ease-standard)"
      }
    }
  },

  plugins: []
} as Config;
