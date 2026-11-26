import path from "node:path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import { sentryVitePlugin } from "@sentry/vite-plugin"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Bitácora",
        short_name: "Bitácora",
        lang: "es",
        // = --background dark (index.css). Splash y barra de estado sin salto de color.
        background_color: "#131315",
        theme_color: "#131315",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-rounded.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
    // Lee SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN del env (Vercel) o de
    // `.env.sentry-build-plugin` (local, gitignored). Sin token no sube nada.
    // El repo es público: los .map se quedan en dist.
    sentryVitePlugin({ telemetry: false }),
  ],
  build: { sourcemap: true },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "node_modules/**", ".claude/**"],
    setupFiles: "./src/test/setup.ts",
    // Tests corren sin Supabase por defecto (hasSupabaseEnv = false) para que localStore
    // testee el branch "sin env". El .env real existe localmente pero no debe filtrarse a tests.
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
})
