import { Button } from "@/core/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"

// Cola vacía o batch terminado → estado claro, no error (review/02). Antes inline en review.tsx.
export function ReviewEmpty({
  count,
  readToday,
  onLoadMore,
}: {
  count: number
  readToday: number
  onLoadMore: () => void
}) {
  return (
    <Empty className="px-4 py-12 sm:px-8 sm:py-16">
      <EmptyHeader>
        <EmptyTitle className="text-lg">
          {count === 0 ? "Nada para repasar hoy." : "Batch terminado."}
        </EmptyTitle>
        <EmptyDescription>
          {readToday} {readToday === 1 ? "nota leída" : "notas leídas"} hoy.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onLoadMore}>
          Cargar más
        </Button>
      </EmptyContent>
    </Empty>
  )
}
