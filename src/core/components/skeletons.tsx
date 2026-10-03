import { Card } from "@/core/ui/card"
import { Skeleton } from "@/core/ui/skeleton"
import { readSample } from "@/core/lib/sample"

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

// Las medidas de lo que sigue están calcadas del DOM real (alturas de línea, paddings, anchos del
// toolbar): si cambia el layout de review/habit-tiles/notebooks, hay que retocarlas a mano.

// Grilla de tarjetas de notebook (la vista por defecto), una por fila de la última carga.
export function NotebookCardsSkeleton() {
  const count = readSample().notebooks
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-3.5 p-5 ring-0">
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0" />
            <span className="flex min-h-[2.6em] flex-1 items-center">
              <Skeleton className="h-4 w-3/5" />
            </span>
            <Skeleton className="mt-2 size-2 shrink-0 rounded-full" />
          </div>
          <div className="flex min-h-6 items-center gap-1.5">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="mt-auto flex items-center justify-between">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="size-[30px] rounded-lg" />
          </div>
        </Card>
      ))}
    </div>
  )
}

// Tira de hábitos: tantos tiles como tenía la última vez (ver sample.ts).
export function HabitsSkeleton() {
  const count = readSample().habits
  return (
    <div className="mb-8">
      <div className="mb-3 flex h-8 items-center gap-3">
        <Skeleton className="h-5 w-[91px]" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-[49px]" />
        <Skeleton className="h-8 w-[82px]" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card px-3.5 py-3"
          >
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-muted" />
            <Skeleton className="size-10 shrink-0 rounded-[10px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-[11px] w-3/5" />
              <span className="flex gap-[3px] pt-0.5">
                {Array.from({ length: 7 }, (__, d) => (
                  <Skeleton key={d} className="h-[5px] flex-1 rounded-full" />
                ))}
              </span>
            </span>
            <span className="flex w-[66px] shrink-0 justify-end">
              <Skeleton className="size-9 rounded-lg" />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Un grupo del sidebar (Fijado/Activos/Recientes): label con chevron y filas h-10 sin fondo, como
// la fila real en reposo (el fondo es solo del hover). Cerrado: solo el label, igual que el Collapsible real.
// Nombres de largo variable: una columna de barras iguales se lee como un bloque, no como una lista.
const NAME_WIDTHS = ["82%", "94%", "66%", "88%", "74%"]

export function SidebarGroupSkeleton({
  label,
  rows,
  open,
}: {
  label: string
  rows: number
  open: boolean
}) {
  if (rows === 0) return null
  return (
    <div className="p-2 pb-0">
      <div className="flex h-8 items-center gap-1 px-2">
        <Skeleton className="size-3 rounded-sm" />
        {/* ~9px por letra: el eyebrow es 11px con tracking-widest */}
        <Skeleton className="h-2.5" style={{ width: label.length * 9 }} />
      </div>
      {open && (
        <div className="flex flex-col gap-1">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex h-10 items-center gap-2 px-2">
              <Skeleton className="size-5 shrink-0" />
              <Skeleton className="h-3.5" style={{ width: NAME_WIDTHS[i % NAME_WIDTHS.length] }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Pantalla Hoy completa: stats, meta, card de repaso, hábitos y notebooks (cabecera, toolbar,
// tarjetas), con las mismas medidas que el contenido real para que al cargar no salte nada.
export function ReviewSkeleton() {
  return (
    <>
      <div className="mb-4 flex h-[18.7px] items-center justify-between">
        <Skeleton className="h-3 w-[118px]" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-[101px]" />
        </div>
      </div>
      <Skeleton className="mb-8 h-0.5 w-full" />

      <Card className="mb-8 py-6">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
          <div className="mb-2 flex h-[39px] items-start justify-between gap-3">
            <Skeleton className="h-4 w-[290px]" />
            <Skeleton className="h-4 w-9" />
          </div>
          <div className="mb-6">
            <div className="mb-1.5 flex h-[101.2px] items-start">
              <div className="flex h-[50.6px] w-3/4 items-center">
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            {[100, 92, 80].map((w) => (
              <div key={w} className="flex h-[19.5px] items-center">
                <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-end border-t pt-5 md:justify-between">
            <div className="hidden gap-2 md:flex">
              <Skeleton className="h-8 w-[94px]" />
              <Skeleton className="h-8 w-[195px]" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-[85px]" />
              <Skeleton className="h-8 w-[104px]" />
            </div>
          </div>
        </div>
      </Card>

      <HabitsSkeleton />

      <div className="mb-6 flex h-[31.2px] items-center gap-3">
        <Skeleton className="h-5 w-[129px]" />
        <Skeleton className="h-3 w-[86px]" />
      </div>
      <div className="mb-5 flex items-center gap-2">
        <Skeleton className="h-8 w-[220px]" />
        <Skeleton className="h-8 w-[147px]" />
        <Skeleton className="h-8 w-[125px]" />
        <Skeleton className="ml-auto h-8 w-[67px]" />
        <Skeleton className="h-8 w-[141px]" />
      </div>
      <NotebookCardsSkeleton />
    </>
  )
}
