import path from "node:path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ registerType: "autoUpdate" }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    // Sin .env en CI (está gitignored). Valores dummy para que createClient no tire al importar.
    env: {
      VITE_SUPABASE_URL: "http://localhost",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
})
