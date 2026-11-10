import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF7F2",
        ink: "#2B3A4A",
        soft: "#5E6C7B",
        sage: { DEFAULT: "#4F8F80", dark: "#3B7366", light: "#DDEDE8" },
        sky: { DEFAULT: "#A9D3E8", light: "#E6F2F8" },
        gold: { DEFAULT: "#F2C66D", light: "#FBF0D5" },
        blush: { DEFAULT: "#EFC9BC", light: "#FAECE6" },
        line: "#E6E0D6",
      },
      fontFamily: {
        sans: ["ui-rounded", "SF Pro Rounded", "Nunito", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(43,58,74,0.06), 0 4px 14px rgba(43,58,74,0.05)" },
    },
  },
  plugins: [],
};
export default config;
