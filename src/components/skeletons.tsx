import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// Placeholders con la forma del contenido real, no rectángulos genéricos. Se muestran solo en el
// primer fetch: con datos en caché TanStack deja `isLoading` en false y no pasan por acá.

// Nota a página completa: barra de vuelta, título y unas líneas de cuerpo.
export function NoteSkeleton() {
  return (
    <div className="mx-auto max-w-read px-8 pt-9 pb-16">
      <div className="mb-8 flex items-center gap-2.5">
        <Skeleton className="size-[30px] rounded-lg" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="mb-6 h-8 w-2/3" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}

// Tabla de cursos: nombre, estado, barra de progreso y contador por fila.
export function TableSkeleton() {
  return (
    <Card className="p-0">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b px-3 py-3 last:border-b-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-1 w-[140px]" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </Card>
  )
}
