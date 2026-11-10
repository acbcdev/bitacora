import { ChevronLeft, ChevronRight } from "lucide-react"

// Ghost con el lenguaje de ViewPill: activo relleno muted, números en mono (DS), flechas sin label.
// ponytail: sin elipsis — a 59 notebooks son 5 páginas y entran todas. Si `pages` crece, agregarla.
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
const ARROW = `flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4 ${FOCUS}`

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
    <nav aria-label="paginación" className="mt-8 flex items-center justify-center gap-1">
      <button
        type="button"
        className={ARROW}
        disabled={page === 1}
        onClick={() => goToPage(page - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? "page" : undefined}
          onClick={() => goToPage(n)}
          className={`flex size-8 cursor-pointer items-center justify-center rounded-full font-mono text-sm tabular-nums transition-colors ${FOCUS} ${
            n === page ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={ARROW}
        disabled={page === pages}
        onClick={() => goToPage(page + 1)}
        aria-label="Página siguiente"
      >
        <ChevronRight />
      </button>
    </nav>
  )
}
