import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // Override slate with blue-tinted neutrals for institutional cohesion.
        // Every bg-slate-*, text-slate-*, border-slate-* now carries a subtle
        // blue undertone that ties surfaces to the brand hue.
        slate: {
          50:  "oklch(0.975 0.006 250)",
          100: "oklch(0.950 0.008 250)",
          200: "oklch(0.910 0.010 250)",
          300: "oklch(0.830 0.012 250)",
          400: "oklch(0.640 0.010 250)",
          500: "oklch(0.530 0.010 250)",
          600: "oklch(0.440 0.010 250)",
          700: "oklch(0.370 0.012 250)",
          800: "oklch(0.280 0.010 250)",
          900: "oklch(0.200 0.008 250)",
          950: "oklch(0.130 0.006 250)",
        },
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};
export default config;
