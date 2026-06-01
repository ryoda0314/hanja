import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Capacitor 等で file:// から読み込めるよう相対パスにしておく（iOS ラップ時に有効）
  base: "./",
  server: {
    host: true,
  },
});
