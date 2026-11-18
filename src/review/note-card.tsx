import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { Button } from "@/core/ui/button"
import { Kbd, KbdGroup } from "@/core/ui/kbd"
import { docToPlainText } from "@/core/lib/tiptap-markdown"
import { MOD } from "@/core/lib/utils"
import { useIsMobile } from "@/core/lib/hooks/use-mobile"
import type { Notebook, Note } from "@/core/types/database"

type Props = {
  note?: Note // la nota completa: título y extracto llegan juntos (ADR 0025)
  notebook?: Notebook
  position: string
  stats?: ReactNode // racha + meta de lectura (ReadChip), al lado de la posición
  onOpen: () => void
  onOpenExpanded: () => void
  onPrev: () => void
  onNext: () => void
  isFirst: boolean
}

export function NoteCard({
  note,
  notebook,
  position,
  stats,
  onOpen,
  onOpenExpanded,
  onPrev,
  onNext,
  isFirst,
}: Props) {
  const isMobile = useIsMobile()
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ${note?.title || "nota sin título"}`}
        className="absolute inset-0 cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none"
      />
      {/* Mobile: una sola fila (notebook + chip); la posición baja al footer. */}
      <div className="mb-2 flex min-h-[2lh] items-start justify-between gap-3 max-md:min-h-0 max-md:items-center">
        <p className="eyebrow flex min-w-0 items-center gap-1.5">
          <NotebookIcon icon={notebook?.icon ?? null} />
          <span className="min-w-0 truncate">{notebook?.name ?? "Sin notebook"}</span>
        </p>
        <span className="flex shrink-0 items-center gap-4 whitespace-nowrap">
          {stats}
          {position && !isMobile && <span className="mono-dim">{position}</span>}
        </span>
      </div>
      <div key={note?.id} className="note-in mb-5">
        {/* text-display: 44px, peso por tema (--display-weight). */}
        <h1 className="mb-2.5 line-clamp-2 min-h-[2lh] text-display text-pretty max-md:min-h-0 max-md:text-2xl">
          {note && (note.title || "(sin título)")}
        </h1>
        <p className="line-clamp-5 min-h-[5lh] max-w-[70ch] text-muted-foreground max-md:min-h-0 max-md:line-clamp-4">
          {note && (docToPlainText(note.content) || <em>Nota sin contenido todavía.</em>)}
        </p>
      </div>

      <div className="relative z-10 mt-2 flex items-center justify-between border-t pt-5">
        {position && isMobile && <span className="mono-dim">{position}</span>}
        <div className="hidden flex-wrap items-center gap-2 text-xs text-muted-foreground md:flex">
          <Button variant="ghost" onClick={onOpen}>
            <Kbd aria-hidden>Enter</Kbd>
            Abrir
          </Button>
          <Button variant="ghost" onClick={onOpenExpanded}>
            <KbdGroup aria-hidden>
              <Kbd>{MOD}</Kbd>+<Kbd>Enter</Kbd>
            </KbdGroup>
            Vista expandida
          </Button>
        </div>
        <div className="flex items-center gap-2 max-md:flex-1">
          <Button
            variant="secondary"
            size="icon-xl"
            aria-label="Anterior"
            disabled={isFirst}
            onClick={onPrev}
          >
            <ArrowLeft />
          </Button>
          <Button size="xl" className="max-md:flex-1" onClick={onNext}>
            Siguiente
          </Button>
        </div>
      </div>
    </>
  )
}
