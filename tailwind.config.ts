import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F7F4EE",
        ink: "#22313F",
        soft: "#55636F",
        sage: { DEFAULT: "#3E7F70", dark: "#2F6659", light: "#DCEBE6" },
        sky: { DEFAULT: "#A9D3E8", light: "#DDEBF3", deep: "#2B6485" },
        gold: { DEFAULT: "#F2C66D", light: "#FBF0D5", deep: "#7A5408" },
        blush: { DEFAULT: "#EFC9BC", light: "#FAECE6" },
        line: "#E4DED3",
        sand: "#F1EDE5",
      },
      fontFamily: {
        sans: ["Nunito Variable", "Nunito", "ui-rounded", "SF Pro Rounded", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(34,49,63,0.05), 0 6px 18px rgba(34,49,63,0.06)", float: "0 8px 24px rgba(34,49,63,0.10)" },
    },
  },
  plugins: [],
};
export default config;
