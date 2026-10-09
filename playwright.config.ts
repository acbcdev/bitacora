import { defineConfig, devices } from "@playwright/test"

// Smoke local-only (ticket 06): fuera de CI y de pre-commit. Puerto propio para no tocar el dev
// server normal; localStorage es por origen, así que la sesión de :5173 queda intacta.
export default defineConfig({
  testDir: "e2e",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: { baseURL: "http://localhost:5198" },
  webServer: {
    command: "pnpm dev --port 5198 --strictPort",
    url: "http://localhost:5198",
    reuseExistingServer: false,
  },
})
