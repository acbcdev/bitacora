import { useRef } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/core/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu"
import { store } from "@/core/store"
import { useSnapshot } from "@/core/lib/snapshot"
import type { Caps } from "@/core/agent/capabilities"
import { supportsVision, type Attachment } from "@/core/agent/attachments"
import { readFile, resolveRef, type AttachRef } from "@/agent/attachments"

export type Picked = { label: string; attachment: Attachment }

// El `+` del composer: referencias (nota/notebook/hábito) y archivos. Imágenes solo con visión.
export function AttachMenu({ caps, onPick }: { caps?: Caps; onPick: (p: Picked) => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const vision = supportsVision(caps)
  const { data } = useSnapshot((s) => ({
    nota: s.notes.filter((n) => n.kind === "note").map((n) => ({ id: n.id, label: n.title })),
    notebook: s.notebooks.map((n) => ({ id: n.id, label: n.name })),
    habito: s.habits.map((h) => ({ id: h.id, label: h.name })),
  }))

  async function pickRef(r: AttachRef, label: string) {
    try {
      onPick({ label, attachment: await resolveRef(store, r) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function pickFiles(files: FileList | null) {
    for (const f of files ?? []) {
      try {
        onPick({ label: f.name, attachment: await readFile(f) })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    }
    if (fileInput.current) fileInput.current.value = ""
  }

  const groups = [
    ["nota", "Nota"],
    ["notebook", "Notebook"],
    ["habito", "Hábito"],
  ] as const

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept={`text/*,.md,.csv,.json,.yml,.yaml,.ts,.tsx,.js,.jsx,.py,.sql${vision ? ",image/*" : ""}`}
        onChange={(e) => void pickFiles(e.target.files)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Adjuntar">
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {groups.map(([kind, name]) => (
            <DropdownMenuSub key={kind}>
              <DropdownMenuSubTrigger disabled={!data?.[kind].length}>
                {name}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {data?.[kind].map((x) => (
                  <DropdownMenuItem
                    key={x.id}
                    onSelect={() => void pickRef({ kind, id: x.id }, x.label || "(sin título)")}
                  >
                    {x.label || "(sin título)"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            Archivo{vision ? " o imagen" : ""}…
          </DropdownMenuItem>
          {!vision && (
            <span
              className="block px-2 py-1.5 text-xs text-muted-foreground"
              title="Este modelo no soporta imágenes"
            >
              Imágenes deshabilitadas: el modelo no tiene visión
            </span>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
