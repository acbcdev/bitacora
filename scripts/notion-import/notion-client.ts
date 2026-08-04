import { Client } from "@notionhq/client"

// Notion rate limit ~3 req/s (spec). El SDK ya reintenta 429/5xx con backoff (Retry-After o
// exponencial) — acá solo se espacian los requests para no gatillarlos en primer lugar.
const MIN_INTERVAL_MS = 350

export function createNotionClient(token: string): Client {
  let lastCall = 0
  return new Client({
    auth: token,
    retry: { maxRetries: 5 },
    async fetch(url, init) {
      const wait = MIN_INTERVAL_MS - (Date.now() - lastCall)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      lastCall = Date.now()
      return fetch(url, init as RequestInit)
    },
  })
}
