import type { Config } from "tailwindcss";
// A static import, not require(). This file is an ES module — `import type`
// above, `export default` below — so `require` is not defined in it, and
// Tailwind's loader only made that work by accident: it tries `require(path)`
// first and falls back to jiti, whose transform happens to supply a shim. From
// Node 22.18 type-stripping is on by default, so the first attempt now gets far
// enough to evaluate the file as real ESM and dies on the require() call.
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        /*
         * Two entries per face, and the second is not a typo. Google's `latin`
         * subset omits U+20B9 — the rupee sign, which this app prints on nearly
         * every screen — so each family ships a `latin-ext` companion and the
         * browser resolves it per glyph, taking ₹ from the second and the rest
         * from the first. See app/layout.tsx.
         */
        sans: [
          "var(--font-sans)",
          "var(--font-sans-ext)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "var(--font-display-ext)",
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      /*
       * `lg`/`md`/`sm` came off the token already; `xl` and up did not, so the
       * nineteen places that say `rounded-xl`, `rounded-2xl` or `rounded-3xl`
       * used to ignore a change to `--radius` and stay soft while everything
       * around them sharpened. Deriving them here keeps the whole app's
       * cornering a single number.
       *
       * `rounded-full` is deliberately untouched: those are avatars, pills and
       * badges, and a pill with a 4px corner is just a small rectangle.
       */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 2px)",
        "2xl": "calc(var(--radius) + 4px)",
        "3xl": "calc(var(--radius) + 8px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
