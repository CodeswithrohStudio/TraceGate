import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b1014",
        surface: "#161b20",
        primary: "#2676c6",
        secondary: "#1a2f47",
        accent: "#e97486",
        border: "#22272c",
        text: "#e9f3fe",
        muted: "#9fb0bf"
      },
      fontFamily: {
        display: ["Archivo", "sans-serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"]
      },
      borderRadius: {
        panel: "8px"
      }
    }
  },
  plugins: []
} satisfies Config;
