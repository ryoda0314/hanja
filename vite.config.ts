import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "한자 도감 — 韓国語 漢字語あつめ",
        short_name: "한자 도감",
        description: "韓国語の漢字語を集めて学べる学習アプリ",
        lang: "ko",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0b0d",
        theme_color: "#0b0b0d",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // アプリシェル＋辞書データ（words.json 等）をプリキャッシュしてオフライン動作させる。
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,json}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Google Fonts（明朝/サンセリフ）は初回オンライン後キャッシュ。
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // Capacitor 等で file:// から読み込めるよう相対パスにしておく（iOS ラップ時に有効）
  base: "./",
  server: {
    host: true,
  },
});
