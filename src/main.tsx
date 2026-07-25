import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { LucideProvider } from "lucide-react"
import { App } from "@/app"
import "@/index.css"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Iconos del DS: 16px, stroke 1.5. Se setea una vez acá y no en cada <Icon />. */}
        <LucideProvider size={16} strokeWidth={1.5}>
          <App />
        </LucideProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
