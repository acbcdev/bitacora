import { ArrowLeft } from "lucide-react"
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { Button } from "@/core/ui/button"
import { Kbd, KbdGroup } from "@/core/ui/kbd"
import { docToPlainText } from "@/core/lib/tiptap-markdown"
import { cn, MOD } from "@/core/lib/utils"
import type { Notebook, Note } from "@/core/types/database"
import type { NoteRef } from "@/core/store/types"

const FOOTER_BTN = "hover:bg-input dark:hover:bg-input"

type Props = {
  item: NoteRef
  notebook?: Notebook
  openNote?: Note
  position: string
  onOpen: () => void
  onOpenExpanded: () => void
  onPrev: () => void
  onNext: () => void
  isFirst: boolean
}

export function NoteCard({
  item,
  notebook,
  openNote,
  position,
  onOpen,
  onOpenExpanded,
  onPrev,
  onNext,
  isFirst,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ${item.title || "nota sin título"}`}
        className="absolute inset-0 cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none"
      />
      <div className="mb-2 flex min-h-[2lh] items-start justify-between gap-3">
        <p className="eyebrow flex items-center gap-1.5">
          <NotebookIcon icon={notebook?.icon ?? null} />
          {notebook?.name ?? "Sin notebook"}
        </p>
        <span className="mono-dim shrink-0 whitespace-nowrap">{position}</span>
      </div>
      <div key={item.id} className="note-in mb-6">
        {/* 44px liviano: 400 en light, 300 en dark — claro sobre oscuro engorda (irradiación). */}
        <h1 className="mb-2.5 line-clamp-2 min-h-[2lh] text-[44px] leading-[1.1] font-normal tracking-[-0.035em] text-pretty dark:font-light">
          {item.title || "(sin título)"}
        </h1>
        <p className="line-clamp-3 min-h-[3lh] max-w-[70ch] text-muted-foreground">
          {openNote && (docToPlainText(openNote.content) || <em>Nota sin contenido todavía.</em>)}
        </p>
      </div>

      <div className="relative z-10 mt-8 flex items-center justify-end border-t pt-5 md:justify-between">
        <div className="hidden flex-wrap items-center gap-2 text-xs text-muted-foreground md:flex">
          <Button variant="ghost" className={FOOTER_BTN} onClick={onOpen}>
            <Kbd aria-hidden>Enter</Kbd>
            Abrir
          </Button>
          <Button variant="ghost" className={FOOTER_BTN} onClick={onOpenExpanded}>
            <KbdGroup aria-hidden>
              <Kbd>{MOD}</Kbd>+<Kbd>Enter</Kbd>
            </KbdGroup>
            Vista expandida
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            aria-label="Anterior"
            className={cn(FOOTER_BTN, "size-13 border-foreground/10")}
            disabled={isFirst}
            onClick={onPrev}
          >
            <ArrowLeft />
          </Button>
          <Button className="h-13 px-7.5 text-[15px]" onClick={onNext}>
            Siguiente
          </Button>
        </div>
      </div>
    </>
  )
}
