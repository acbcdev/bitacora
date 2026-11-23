import { useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
import { cn } from "@/core/lib/utils"
import { ConfirmDelete } from "@/core/components/confirm-delete"
import { fetchCapabilities } from "@/core/agent/capabilities"
import {
  DEFAULT_ANTHROPIC_MODEL,
  PRESETS,
  fetchModels,
  mergeModels,
  saveAgentSettings,
  withProvider,
  withoutProvider,
  type ProviderConfig,
  type ProviderKind,
} from "@/core/agent/provider"
import { useAgentSettings } from "@/agent/use-provider"
import { ProviderIcon } from "@/agent/provider-icon"
import { ProviderModels } from "@/agent/provider-models"

const KINDS: { kind: ProviderKind; name: string }[] = [
  { kind: "anthropic", name: "Anthropic" },
  { kind: "openrouter", name: "OpenRouter" },
  { kind: "openai-compatible", name: "Compatible con OpenAI" },
]

function blank(kind: ProviderKind): ProviderConfig {
  return {
    id: crypto.randomUUID(),
    kind,
    name: KINDS.find((k) => k.kind === kind)!.name,
    apiKey: "",
    baseUrl: kind === "openai-compatible" ? "" : undefined,
    models: kind === "anthropic" ? [{ id: DEFAULT_ANTHROPIC_MODEL, visible: true }] : [],
  }
}

const isLocal = (url?: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(url ?? "")

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? <Check /> : <Copy />}
      {done ? "Copiado" : "Copiar"}
    </Button>
  )
}

// Cómo permitir el origin de la app en cada servidor local conocido.
const CORS_HOWTO: Record<string, { name: string; text: string; cmd?: (origin: string) => string }> =
  {
    ollama: {
      name: "Ollama",
      text: "Cerrá Ollama y arrancalo con tu origin permitido:",
      cmd: (o) => `OLLAMA_ORIGINS=${o} ollama serve`,
    },
    lmstudio: {
      name: "LM Studio",
      text: "Developer → Server Settings → activá “Enable CORS” y reiniciá el servidor.",
    },
  }

// Local = el navegador bloquea la llamada hasta que el servidor acepte el origin de la app. Con
// preset conocido muestra solo SU instrucción; con una URL local propia, todas.
function CorsHint({ preset }: { preset?: string }) {
  const origin = window.location.origin
  const keys = preset && CORS_HOWTO[preset] ? [preset] : Object.keys(CORS_HOWTO)
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 text-sm">
      <div>
        <p className="font-medium">Permití el acceso desde esta app</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          El navegador bloquea las llamadas a tu servidor local hasta que acepte{" "}
          <span className="mono">{origin}</span>.
        </p>
      </div>
      {keys.map((k) => {
        const { name, text, cmd } = CORS_HOWTO[k]
        return (
          <div key={k} className="flex flex-col gap-1.5">
            {keys.length > 1 && (
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <ProviderIcon
                  provider={{ kind: "openai-compatible", preset: k }}
                  className="size-3.5"
                />
                {name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{text}</p>
            {cmd && (
              <div className="flex items-center gap-2 rounded-md bg-background/60 py-1 pr-1 pl-2.5">
                <code className="mono min-w-0 flex-1 break-all">{cmd(origin)}</code>
                <CopyButton text={cmd(origin)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Altura animada sin medirla (grid 0fr → 1fr). `inert` cerrado: no toma foco ni lo lee un lector.
function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

// Input sin caja: la caja es el grupo de filas, no cada campo.
const BARE =
  "h-10 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-4">
      <span className="w-20 shrink-0 text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function ProviderForm({ initial, onDone }: { initial: ProviderConfig; onDone: () => void }) {
  const { settings } = useAgentSettings()
  const [draft, setDraft] = useState(initial)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const compat = draft.kind === "openai-compatible"
  const patch = (p: Partial<ProviderConfig>) => setDraft((d) => ({ ...d, ...p }))
  const canTest = compat ? !!draft.baseUrl?.trim() : !!draft.apiKey.trim()
  const canSave = canTest && draft.models.some((m) => m.visible)

  async function test() {
    setTesting(true)
    setStatus(null)
    try {
      const probe = { ...draft, apiKey: draft.apiKey.trim() }
      const ids = await fetchModels(probe)
      const caps = await fetchCapabilities(probe, ids)
      setDraft((d) => ({ ...d, models: mergeModels(d.models, ids, caps) }))
      setStatus({ ok: true, text: `Conexión OK: ${ids.length} modelos.` })
    } catch (e) {
      // Error crudo; el usuario puede tipear el id del modelo a mano.
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <form
      className="mt-3 flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        saveAgentSettings(
          withProvider(settings, {
            ...draft,
            name: draft.name.trim() || draft.name,
            apiKey: draft.apiKey.trim(),
            baseUrl: draft.baseUrl?.trim(),
          }),
        )
        onDone()
      }}
    >
      {compat && (
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="xs"
              variant={draft.preset === p.key ? "secondary" : "outline"}
              onClick={() => {
                patch({ preset: p.key, name: p.name, baseUrl: p.baseUrl })
                setStatus(null)
              }}
            >
              <ProviderIcon
                provider={{ kind: "openai-compatible", preset: p.key }}
                className="size-3.5"
              />
              {p.name}
            </Button>
          ))}
        </div>
      )}

      <div>
        <div className="flex flex-col divide-y divide-border/60 border-y border-border/60">
          <Row label="Nombre">
            <Input
              aria-label="Nombre"
              className={BARE}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Row>
          {compat && (
            <Row label="Base URL">
              <Input
                aria-label="Base URL"
                className={BARE}
                placeholder="https://…/v1"
                value={draft.baseUrl ?? ""}
                onChange={(e) => patch({ baseUrl: e.target.value, preset: undefined })}
              />
            </Row>
          )}
          <Row label="API key">
            <Input
              type="password"
              aria-label="API key"
              className={BARE}
              placeholder={
                compat ? "opcional" : draft.kind === "anthropic" ? "sk-ant-…" : "sk-or-…"
              }
              autoComplete="off"
              value={draft.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
            />
          </Row>
          <div className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 text-sm">
              {testing ? (
                <span className="text-muted-foreground">Probando…</span>
              ) : status ? (
                <p
                  role={status.ok ? "status" : "alert"}
                  className={cn("break-words", status.ok ? "text-signal" : "text-destructive")}
                >
                  {status.text}
                </p>
              ) : (
                <span className="text-muted-foreground">Sin probar</span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!canTest || testing}
              onClick={test}
            >
              {testing && <Loader2 className="animate-spin" />}
              Probar conexión
            </Button>
          </div>
        </div>
        {compat && (
          <Reveal open={isLocal(draft.baseUrl)}>
            <div className="pt-3">
              <CorsHint preset={draft.preset} />
            </div>
          </Reveal>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="eyebrow">
          Modelos visibles ({draft.models.filter((m) => m.visible).length}/{draft.models.length})
        </p>
        <ProviderModels
          models={draft.models}
          onChange={(models) => setDraft((d) => ({ ...d, models }))}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave}>
          Guardar
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// Sección "Proveedor" de Ajustes: varios a la vez, por dispositivo (la key nunca sale del navegador
// salvo hacia el propio Proveedor).
export function ProviderSettings() {
  const { settings } = useAgentSettings()
  const [editing, setEditing] = useState<ProviderConfig | null>(null)
  const [removing, setRemoving] = useState<ProviderConfig | null>(null)

  return (
    <section id="agent-provider">
      <ul className="mt-3 flex flex-col gap-1">
        {settings.providers.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <ProviderIcon provider={p} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.name}{" "}
              <span className="mono-dim">{p.models.filter((m) => m.visible).length} modelos</span>
            </span>
            <Button size="xs" variant="ghost" onClick={() => setEditing(p)}>
              Editar
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setRemoving(p)}>
              Quitar
            </Button>
          </li>
        ))}
      </ul>
      {editing ? (
        <ProviderForm key={editing.id} initial={editing} onDone={() => setEditing(null)} />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button
              key={k.kind}
              variant="outline"
              size="sm"
              onClick={() => setEditing(blank(k.kind))}
            >
              <ProviderIcon provider={{ kind: k.kind }} />
              {k.name}
            </Button>
          ))}
        </div>
      )}
      <ConfirmDelete
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        what={removing?.name ?? ""}
        verb="Quitar"
        onConfirm={() => {
          if (!removing) return
          saveAgentSettings(withoutProvider(settings, removing.id))
          if (editing?.id === removing.id) setEditing(null)
        }}
      />
    </section>
  )
}
