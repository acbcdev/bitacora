import { Card } from "@/core/ui/card"
import { Skeleton } from "@/core/ui/skeleton"
import { readSample } from "@/core/lib/sample"
import { HISTORY_DAYS } from "@/core/store/derive"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import { PAGE_SIZE, PAGE_SIZE_MOBILE } from "@/notebooks/notebooks.api"

// Placeholders con la forma del contenido real, no rectángulos genéricos. Se muestran solo en el
// primer fetch: con datos en caché TanStack deja `isLoading` en false y no pasan por acá.

// Nota a página completa: barra de vuelta, título y unas líneas de cuerpo.
export function NoteSkeleton() {
  return (
    <div className="mx-auto max-w-read px-8 pt-9 pb-16">
      <div className="mb-8 flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-lg" />
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
  const pageSize = useIsMobile() ? PAGE_SIZE_MOBILE : PAGE_SIZE
  const count = Math.min(readSample().notebooks, pageSize)
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          // 150.5px = alto de NotebookCard real. Página llena = hay paginación debajo (nav mt-8 h-8).
          <Card key={i} className="min-h-[150.5px] gap-3 p-5 ring-0">
            <div className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0" />
              <span className="flex min-h-[2.6em] flex-1 items-center">
                <Skeleton className="h-4 w-3/5" />
              </span>
              <Skeleton className="mt-2 size-2 shrink-0 rounded-dot" />
            </div>
            <div className="flex min-h-6 items-center gap-1.5">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="mt-auto flex items-center justify-between">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
      {count >= pageSize && <Skeleton className="mx-auto mt-8 h-8 w-48 rounded-pill max-md:mt-6" />}
    </>
  )
}

// Tira de hábitos: tantos tiles como tenía la última vez (ver sample.ts), plegada a 6 como HabitFold.
export function HabitsSkeleton() {
  const count = readSample().habits
  const rest = Math.max(count - 6, 0)
  return (
    <div className="mb-8">
      {/* Cabecera: "Hábitos" + N/M cumplidos · ViewPill · Todos · Nuevo (medidas del DOM real) */}
      <div className="mb-4 flex h-8 items-center gap-3">
        <Skeleton className="h-5 w-[73px]" />
        <Skeleton className="h-3 w-[106px]" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="h-8 w-[74px] rounded-pill max-md:hidden" />
          <Skeleton className="h-8 w-[83px] rounded-pill max-md:w-8" />
          <Skeleton className="h-8 w-[85px] rounded-pill max-md:w-8" />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3">
        {Array.from({ length: Math.min(count, 6) }, (_, i) => (
          // Mismo bloque que HabitTile vacío: hatch + card de 140px, así la tira no salta al cargar.
          <div
            key={i}
            className="hatch relative flex min-h-[146px] flex-col justify-between gap-3 overflow-hidden rounded-xl bg-card p-4 shadow-card"
          >
            {/* Arriba: ícono redondo · nombre + estado · botón de acción rápida */}
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-pill" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-10" />
              </span>
              <Skeleton className="size-9 shrink-0" />
            </div>
            {/* Abajo: número grande (40px) y pie con meta a la izquierda, dots 7d a la derecha */}
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-16" />
              <span className="flex items-center justify-between gap-2">
                <Skeleton className="h-[11px] w-20" />
                <span className="flex gap-1">
                  {Array.from({ length: 7 }, (__, d) => (
                    <Skeleton key={d} className="size-2 rounded-dot" />
                  ))}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* Fila fantasma de HabitFold: íconos superpuestos · "N más" · nombres · chevron */}
      {rest > 0 && (
        <div className="mt-2 flex h-11 items-center gap-2.5 px-3">
          <span className="flex -space-x-1.5">
            {Array.from({ length: Math.min(rest, 4) }, (_, i) => (
              <Skeleton key={i} className="size-6 rounded-pill ring-2 ring-background" />
            ))}
          </span>
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="ml-auto size-4" />
        </div>
      )}
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
        {/* ~7px por letra: label text-sm en capital case */}
        <Skeleton className="h-3" style={{ width: label.length * 7 }} />
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

// Contenido de la hero card de Repaso (NoteCard). Lo usa también Repaso adentro de su Card
// cuando la nota completa todavía no llegó y no hay card anterior: la página queda montada.
export function ReviewCardSkeleton() {
  if (useIsMobile()) return <ReviewCardSkeletonMobile />
  return (
    <div className="w-full px-5 sm:px-10">
      {/* Eyebrow: ícono + nombre del notebook · ReadChip (h-7) + posición en la cola (min-h 2lh) */}
      <div className="mb-2 flex h-[39px] items-start justify-between gap-3">
        <span className="flex h-[19.5px] items-center gap-1.5">
          <Skeleton className="size-3.5 rounded-xs" />
          <Skeleton className="h-2.5 w-28" />
        </span>
        <span className="flex items-center gap-4">
          <Skeleton className="h-7 w-[136px] rounded-pill" />
          <Skeleton className="h-3 w-9" />
        </span>
      </div>
      <div className="mb-5">
        {/* Título 44px × 2 líneas (lh 1.1 = 48.4px), mb-2.5 */}
        <div className="mb-2.5 flex flex-col">
          {["85%", "55%"].map((w) => (
            <div key={w} className="flex h-[48.4px] items-center">
              <Skeleton className="h-9" style={{ width: w }} />
            </div>
          ))}
        </div>
        {/* Preview del cuerpo: 5 líneas de text-base (lh 19.5px) */}
        {["100%", "96%", "92%", "88%", "70%"].map((w) => (
          <div key={w} className="flex h-[19.5px] items-center">
            <Skeleton className="h-3.5" style={{ width: w }} />
          </div>
        ))}
      </div>
      {/* Footer: atajos Abrir / Vista expandida (md+) · ← y Siguiente (h-13) */}
      <div className="mt-2 flex items-center justify-end border-t pt-5 md:justify-between">
        <div className="hidden gap-2 md:flex">
          <Skeleton className="h-8 w-[94px]" />
          <Skeleton className="h-8 w-[170px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-13" />
          <Skeleton className="h-13 w-[130px]" />
        </div>
      </div>
    </div>
  )
}

// Card en mobile (NoteCard con max-md): una fila notebook + chip, título 2xl, 4 líneas, footer con
// posición a la izquierda y ← / Siguiente a la derecha. Sin alturas mínimas: el texto real tampoco.
function ReviewCardSkeletonMobile() {
  return (
    <div className="w-full px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-7 w-[88px] rounded-pill" />
      </div>
      <div className="mb-5 flex flex-col gap-2">
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="mb-1 h-6 w-1/2" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-5">
        <Skeleton className="h-3 w-9" />
        <div className="flex gap-2">
          <Skeleton className="size-13" />
          <Skeleton className="h-13 w-[130px]" />
        </div>
      </div>
    </div>
  )
}

// Hoy en mobile, más simple a propósito: sin barras de cumplimiento (el real las oculta), la card,
// y de hábitos/notebooks solo cabecera + 2 bloques — lo de abajo del fold no necesita ser fiel.
function ReviewSkeletonMobile() {
  return (
    <>
      <Card className="mb-8 rounded-2xl bg-hero py-5 shadow-hero">
        <ReviewCardSkeletonMobile />
      </Card>
      <div className="mb-8">
        <div className="mb-4 flex h-8 items-center gap-3">
          <Skeleton className="h-5 w-[91px]" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto size-8 rounded-pill" />
          <Skeleton className="size-8 rounded-pill" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="mb-4 flex h-[31.2px] items-center gap-3">
        <Skeleton className="h-5 w-[129px]" />
        <Skeleton className="h-3 w-[86px]" />
      </div>
      <Skeleton className="mb-5 h-8 w-full rounded-pill" />
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </>
  )
}

// Pantalla Hoy completa: stats, meta, card de repaso, hábitos y notebooks (cabecera, toolbar,
// tarjetas), con las mismas medidas que el contenido real para que al cargar no salte nada.
export function ReviewSkeleton() {
  if (useIsMobile()) return <ReviewSkeletonMobile />
  return (
    <>
      {/* ReviewStats: h2 "Repaso" · barras de cumplimiento 14d (h-7), alineadas al padding de la
          card. Racha y meta viven ahora en el ReadChip de la card. */}
      <div className="mb-4 flex h-[31.2px] items-center justify-between pe-5 sm:pe-10">
        <Skeleton className="h-5 w-[86px]" />
        <span className="flex h-7 items-end gap-[3px] self-end">
          {Array.from({ length: HISTORY_DAYS }, (_, i) => (
            <Skeleton key={i} className="h-full w-1 rounded-xs" />
          ))}
        </span>
      </div>

      {/* Hero card (NoteCard): mismo radio, padding y sombra que la real */}
      <Card className="mb-8 rounded-2xl bg-hero py-5 shadow-hero">
        <ReviewCardSkeleton />
      </Card>

      <HabitsSkeleton />

      {/* Notebooks embebido: título + contador, toolbar de chips (buscar · estado · orden · ViewPill · nuevo) */}
      <div className="mb-4 flex h-[31.2px] items-center gap-3">
        <Skeleton className="h-5 w-[129px]" />
        <Skeleton className="h-3 w-[86px]" />
      </div>
      <div className="mb-5 flex items-center gap-2">
        <Skeleton className="h-8 flex-1 rounded-pill sm:w-60 sm:flex-none" />
        <Skeleton className="h-8 w-[120px] rounded-pill max-md:w-16" />
        <Skeleton className="h-8 w-[140px] rounded-pill max-md:w-20" />
        <Skeleton className="ml-auto h-8 w-[74px] rounded-pill max-md:hidden" />
        <Skeleton className="h-8 w-[141px] rounded-pill max-md:w-8" />
      </div>
      <NotebookCardsSkeleton />
    </>
  )
}

// Pantalla Notebook cargando (variant Fantasma, .scratch/notebook-states): mismo layout que
// notebook.tsx. La nota es el editor apagado ("Título" en su lugar real), sin shimmer; el aside,
// barras quietas. Sin pulse: es una pantalla de lectura, el parpadeo es ruido.
export function NotebookSkeleton() {
  return (
    <div className="flex flex-col md:h-full md:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-read px-4 pt-9 sm:px-8">
          <div className="mb-8 h-8" />
          <div className="text-4xl font-semibold tracking-tighter text-muted-foreground/40">
            Título
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col border-b opacity-50 max-md:order-first md:w-68 md:border-b-0 md:border-l">
        {/* Header: ícono · eyebrow + nombre · chips estado/cantidad · % repasado */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 shrink-0 animate-none rounded-lg" />
            <span className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-2.5 w-24 animate-none" />
              <Skeleton className="h-3.5 w-40 animate-none" />
            </span>
          </div>
          <div className="mt-2.5 flex h-5 items-center gap-1.5">
            <Skeleton className="h-5 w-14 animate-none" />
            <Skeleton className="h-5 w-16 animate-none" />
            <Skeleton className="ml-auto h-2.5 w-16 animate-none" />
          </div>
        </div>
        <div className="px-4 pb-1">
          <Skeleton className="h-7 w-full animate-none rounded-lg" />
        </div>
        <div className="flex flex-col gap-px px-2 py-1.5">
          {NAME_WIDTHS.map((w) => (
            <div key={w} className="flex h-8 items-center px-2.5">
              <Skeleton className="h-3 animate-none" style={{ width: w }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
