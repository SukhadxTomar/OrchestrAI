/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Ink scale — the app's canvas. Never pure black: depth needs room below.
        ink: {
          950: "#050508",
          900: "#09090f",
          850: "#0d0d15",
          800: "#12121c",
          700: "#1c1c2a",
          600: "#272738",
          500: "#3a3a50",
        },
        // Signature accent: electric violet → cyan. Used sparingly.
        accent: {
          DEFAULT: "#7c6bff",
          bright: "#9d8fff",
          dim: "#5b4cdb",
          cyan: "#4cc9f0",
        },
        // Semantic — strictly reserved for state.
        ok: "#34d399",
        warn: "#fbbf24",
        danger: "#f87171",
        // Text scale
        fg: {
          DEFAULT: "#ecebf5",
          muted: "#a3a1b8",
          faint: "#6b6980",
          ghost: "#454356",
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // 11px
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }], // 13px
        base: ["0.9375rem", { lineHeight: "1.5rem" }], // 15px
        md: ["1.0625rem", { lineHeight: "1.6rem" }], // 17px
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.75rem", { lineHeight: "2.15rem" }],
        "2xl": ["2.5rem", { lineHeight: "2.9rem" }],
        "3xl": ["4rem", { lineHeight: "4.3rem" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)", // the signature ease
        "in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
        drift: "600ms",
      },
      boxShadow: {
        // Elevation = layered shadow + inner hairline, never a lone box-shadow.
        e1: "0 1px 2px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.04)",
        e2: "0 4px 16px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.06)",
        e3: "0 12px 40px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.08)",
        glow: "0 0 24px rgba(124,107,255,.35), inset 0 0 0 1px rgba(124,107,255,.4)",
        "glow-ok": "0 0 20px rgba(52,211,153,.25), inset 0 0 0 1px rgba(52,211,153,.35)",
        "glow-danger": "0 0 20px rgba(248,113,113,.3), inset 0 0 0 1px rgba(248,113,113,.4)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        blink: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0" } },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.22,1,0.36,1) infinite",
        blink: "blink 1.1s step-end infinite",
        marquee: "marquee 42s linear infinite",
      },
    },
  },
  plugins: [],
};
