import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        coffee: {
          surface: "#F7F5F2",
          primary: "#BFA58C",
          accent: "#C8B6A6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
