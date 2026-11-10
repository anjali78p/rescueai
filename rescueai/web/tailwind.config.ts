import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EDF1EE", ink: "#12262E", mist: "#D5DEDA", sea: "#1F6F80", signal: "#C9302C",
        ember: "#D9772B", sand: "#B8962E", ok: "#2F7D58", slate2: "#5B6B70",
      },
      fontFamily: { sans: ["var(--font-body)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
