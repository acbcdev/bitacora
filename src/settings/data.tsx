import { useState } from "react"
import { AlertTriangle, Cloud, HardDrive } from "lucide-react"
import { Button } from "@/core/ui/button"
import { hasSupabaseEnv } from "@/core/lib/supabase"
import { store } from "@/core/store"
import { setStorageMode } from "@/core/store/mode"
import { cn } from "@/core/lib/utils"
import type { StorageMode } from "@/core/store/types"
import { Block, Group, Page, Row } from "@/settings/ui"

const MODES: {
  mode: StorageMode
  icon: typeof Cloud
  title: string
  detail: string
}[] = [
  {
    mode: "supabase",
    icon: Cloud,
    title: "Supabase",
    detail: "Postgres + auth. Los datos te siguen entre dispositivos.",
  },
  {
    mode: "local",
    icon: HardDrive,
    title: "Este navegador",
    detail: "Sin cuenta, sin red. Todo vive en localStorage de este navegador.",
  },
]

function StorageModes() {
  return (
    <section>
      <div className="flex flex-col gap-1">
        {MODES.map(({ mode, icon: Icon, title, detail }) => {
          const current = store.mode === mode
          const disabled = mode === "supabase" && !hasSupabaseEnv
          return (
            <button
              key={mode}
              type="button"
              disabled={current || disabled}
              onClick={() => setStorageMode(mode)}
              className={cn(
                "flex items-start gap-3 rounded-lg p-3 text-left transition-colors",
                current ? "bg-muted" : "hover:bg-accent",
                disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              <Icon className="mt-0.5 shrink-0" />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {title}
                  {current && <span className="mono-dim">actual</span>}
                </span>
                <span className="text-sm text-muted-foreground">{detail}</span>
                {disabled && (
                  <span className="text-sm text-muted-foreground">
                    Falta configurar <code>VITE_SUPABASE_URL</code> en <code>.env</code>.
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                  current ? "border-foreground" : "border-border-strong/40",
                )}
              >
                {current && <span className="size-2 rounded-full bg-foreground" />}
              </span>
            </button>
          )
        })}
      </div>
      {store.mode === "local" && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 shrink-0" />
          Borrar los datos del navegador borra las notas. No hay copia en ningún lado.
        </p>
      )}
    </section>
  )
}

const CATS: [string, (k: string) => boolean][] = [
  ["Chats del Agente", (k) => k === "agent.chats"],
  ["Proveedores y keys", (k) => k.startsWith("bita-agent")],
  ["Datos locales (notas)", (k) => k.startsWith("bita-local")],
  ["Pins, índice y timer", (k) => /^bita-(pinned|nb-index|timer)/.test(k)],
]

function usage() {
  const rows = CATS.map(([label]) => ({ label, bytes: 0 }))
  let other = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!
    const b = (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2
    const idx = CATS.findIndex(([, test]) => test(k))
    if (idx >= 0) rows[idx].bytes += b
    else other += b
  }
  return [...rows, { label: "Preferencias y otros", bytes: other }]
}

const kb = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`)

export function StoragePage() {
  const [rows, setRows] = useState(usage)
  const [confirm, setConfirm] = useState(false)
  const total = rows.reduce((a, r) => a + r.bytes, 0)
  return (
    <Page title="Almacenamiento" desc="Dónde viven tus datos y cuánto ocupa este navegador.">
      <Group
        title="Dónde se guardan los datos"
        desc="Los dos modos son excluyentes: no hay sync entre ellos. Cambiar recarga la app."
      >
        <Block>
          <StorageModes />
        </Block>
      </Group>
      <Group title="Este navegador" desc="localStorage tiene un tope de ~5 MB por origen.">
        {rows.map((r) => (
          <Row key={r.label} label={r.label}>
            <span className="mono-dim">{kb(r.bytes)}</span>
          </Row>
        ))}
        <Row label="Total">
          <span className="mono-dim">{kb(total)}</span>
        </Row>
      </Group>
      <Group title="Limpiar">
        <Row
          label="Borrar chats del Agente"
          desc="No toca notas, proveedores ni skills. No se puede deshacer."
        >
          {confirm ? (
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  localStorage.removeItem("agent.chats")
                  setRows(usage())
                  setConfirm(false)
                }}
              >
                Sí, borrar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Cancelar
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
              Borrar chats
            </Button>
          )}
        </Row>
      </Group>
    </Page>
  )
}

export function ExportPage() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle")
  const [n, setN] = useState<[number, number]>([0, 0])

  async function run() {
    setState("busy")
    const snap = await store.snapshot()
    const total = snap.notes.length
    const content = new Map<string, unknown>()
    let done = 0
    const queue = [...snap.notes]
    // 8 en paralelo: ~1.500 notas en serie serían minutos de round-trips.
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        for (let ref = queue.shift(); ref; ref = queue.shift()) {
          content.set(ref.id, (await store.note(ref.id)).content)
          setN([++done, total])
        }
      }),
    )
    const out = {
      exportedAt: new Date().toISOString(),
      ...snap,
      notes: snap.notes.map((r) => ({ ...r, content: content.get(r.id) })),
    }
    const a = document.createElement("a")
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }),
    )
    a.download = `bitacora-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setState("done")
  }

  return (
    <Page
      title="Exportar"
      desc="Una copia tuya de todo. En modo «Este navegador» es la única que existe."
    >
      <Group>
        <Row label="Todo en JSON" desc="Notebooks, notas con su contenido, lecturas y hábitos.">
          <Button size="sm" disabled={state === "busy"} onClick={() => void run()}>
            {state === "busy"
              ? `Exportando ${n[0]}/${n[1]}…`
              : state === "done"
                ? "Descargar de nuevo"
                : "Descargar"}
          </Button>
        </Row>
      </Group>
    </Page>
  )
}
