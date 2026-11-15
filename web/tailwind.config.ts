import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EDF1EE", ink: "#12262E", night: "#0B1A20", mist: "#D5DEDA", sea: "#1F6F80", signal: "#C9302C",
        ember: "#D9772B", sand: "#B8962E", ok: "#2F7D58", slate2: "#5B6B70",
      },
      fontFamily: { sans: ["var(--font-body)", "system-ui", "sans-serif"] },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        travel: { "0%": { left: "0%", opacity: "0" }, "12%": { opacity: "1" }, "88%": { opacity: "1" }, "100%": { left: "100%", opacity: "0" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".3" } },
        flash: { "0%": { backgroundColor: "rgba(201,48,44,.28)" }, "100%": { backgroundColor: "rgba(255,255,255,1)" } },
      },
      animation: {
        fadeUp: "fadeUp .6s ease-out both", travel: "travel 3.4s ease-in-out infinite",
        blink: "blink 1.6s ease-in-out infinite", flash: "flash 3s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
