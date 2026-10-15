import { BookOpen, SearchX } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/core/ui/empty"

// Estado vacío compartido por tabla y cards: distingue "no creaste nada" de "los filtros no
// matchean" (con paginado en server no hay lista completa contra la cual comparar).
// `col-span-full`: en cards vive dentro del grid y si no ocupa solo la primera columna.
export function NotebookEmpty({ filtering }: { filtering: boolean }) {
  return (
    <Empty className="hatch col-span-full rounded-xl bg-card py-12 shadow-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">{filtering ? <SearchX /> : <BookOpen />}</EmptyMedia>
        <EmptyTitle>{filtering ? "Sin notebooks que coincidan." : "Sin notebooks."}</EmptyTitle>
        <EmptyDescription>
          {filtering ? "Ajustá los filtros." : "Creá el primero."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
