import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"

// Estado vacío compartido por tabla y cards: distingue "no creaste nada" de "los filtros no
// matchean" (con paginado en server no hay lista completa contra la cual comparar).
export function NotebookEmpty({ filtering }: { filtering: boolean }) {
  return (
    <Empty className="px-3 py-7">
      <EmptyHeader>
        <EmptyTitle>{filtering ? "Sin notebooks que coincidan." : "Sin notebooks."}</EmptyTitle>
        <EmptyDescription>
          {filtering ? "Ajustá los filtros." : "Creá el primero."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
