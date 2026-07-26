import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { LucideProvider } from "lucide-react"
import { toast } from "sonner"
import { App } from "@/app"
import "@/index.css"

// Toda mutation que falla avisa, con el mensaje real de Supabase. Va acá y no hook por hook:
// son seis mutations y ninguna necesita un mensaje propio.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (e) => toast.error(e.message),
  }),
})

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
