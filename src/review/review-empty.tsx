import { CheckCheck, NotebookPen } from "lucide-react"
import { Button } from "@/core/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/core/ui/empty"

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
  // `reviewQueue` no filtra por fecha: cola vacía = no hay ninguna nota viva. Ahí "Cargar más" no
  // trae nada; el flujo es escribir la primera, no repasar.
  if (count === 0)
    return (
      <Empty className="px-4 py-12 sm:px-8 sm:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPen />
          </EmptyMedia>
          <EmptyTitle className="text-lg">Sin notas todavía.</EmptyTitle>
          <EmptyDescription>
            Escribí la primera en un notebook y aparece acá para repasar.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  return (
    <Empty className="px-4 py-12 sm:px-8 sm:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CheckCheck />
        </EmptyMedia>
        <EmptyTitle className="text-lg">Batch terminado.</EmptyTitle>
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
