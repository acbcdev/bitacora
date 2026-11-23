import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/core/ui/button"
import { cn } from "@/core/lib/utils"

// Ghost con el lenguaje de ViewPill: activo relleno muted, números en mono (DS), flechas sin label.
// ponytail: sin elipsis — a 59 notebooks son 5 páginas y entran todas. Si `pages` crece, agregarla.
const ARROW = "max-md:size-10 max-md:text-foreground"

export function NotebookPagination({
  page,
  pages,
  goToPage,
}: {
  page: number
  pages: number
  goToPage: (p: number) => void
}) {
  return (
    <nav
      aria-label="paginación"
      className="mt-8 flex items-center justify-center gap-1 max-md:mx-auto max-md:mt-6 max-md:w-fit max-md:rounded-pill max-md:bg-muted/60 max-md:p-1"
    >
      <Button
        variant="ghost"
        size="icon"
        className={ARROW}
        disabled={page === 1}
        onClick={() => goToPage(page - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft />
      </Button>
      {/* Mobile: "2 / 5" en vez de una fila de números (5 targets de 32px no entran con aire). */}
      <span
        aria-live="polite"
        className="min-w-16 text-center font-mono text-sm text-muted-foreground tabular-nums md:hidden"
      >
        <span className="text-foreground">{page}</span> / {pages}
      </span>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Button
          key={n}
          variant="ghost"
          size="icon"
          aria-current={n === page ? "page" : undefined}
          onClick={() => goToPage(n)}
          className={cn(
            "font-mono tabular-nums max-md:hidden",
            n === page ? "bg-muted text-foreground" : "text-muted-foreground",
          )}
        >
          {n}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        className={ARROW}
        disabled={page === pages}
        onClick={() => goToPage(page + 1)}
        aria-label="Página siguiente"
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}
