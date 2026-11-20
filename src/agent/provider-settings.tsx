import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
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

function CorsHint() {
  const cmd = `OLLAMA_ORIGINS=${window.location.origin}`
  return (
    <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
      <p>
        Un servidor local tiene que permitir el origin de esta app (CORS). En Ollama arrancalo con:
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all">{cmd}</code>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => void navigator.clipboard?.writeText(cmd)}
        >
          Copiar
        </Button>
      </div>
      <p className="mt-1">En LM Studio activá “Enable CORS” en el servidor local.</p>
    </div>
  )
}

function Models({
  draft,
  onChange,
}: {
  draft: ProviderConfig
  onChange: (p: ProviderConfig) => void
}) {
  const [query, setQuery] = useState("")
  const [manual, setManual] = useState("")
  const q = query.trim().toLowerCase()
  const shown = draft.models.filter((m) => m.id.toLowerCase().includes(q))
  const toggle = (id: string) =>
    onChange({
      ...draft,
      models: draft.models.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m)),
    })
  const addManual = () => {
    const id = manual.trim()
    if (!id) return
    const rest = draft.models.filter((m) => m.id !== id)
    onChange({ ...draft, models: [{ id, visible: true }, ...rest] })
    setManual("")
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        Modelos visibles ({draft.models.filter((m) => m.visible).length}/{draft.models.length})
      </p>
      {draft.models.length > 8 && (
        <Input
          aria-label="Buscar modelo"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <ul className="flex max-h-48 flex-col overflow-y-auto">
        {shown.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={m.visible} onChange={() => toggle(m.id)} />
              <span className="min-w-0 break-all">{m.id}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          aria-label="Id de modelo"
          placeholder="Agregar id de modelo a mano"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addManual()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addManual} disabled={!manual.trim()}>
          Agregar
        </Button>
      </div>
    </div>
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
      className="mt-3 flex flex-col gap-3 rounded-md border p-3"
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
              onClick={() => patch({ preset: p.key, name: p.name, baseUrl: p.baseUrl })}
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}
      <Input
        aria-label="Nombre"
        placeholder="Nombre"
        value={draft.name}
        onChange={(e) => patch({ name: e.target.value })}
      />
      {compat && (
        <Input
          aria-label="Base URL"
          placeholder="https://…/v1"
          value={draft.baseUrl ?? ""}
          onChange={(e) => patch({ baseUrl: e.target.value, preset: undefined })}
        />
      )}
      <Input
        type="password"
        aria-label="API key"
        placeholder={
          compat ? "API key (opcional)" : draft.kind === "anthropic" ? "sk-ant-…" : "sk-or-…"
        }
        autoComplete="off"
        value={draft.apiKey}
        onChange={(e) => patch({ apiKey: e.target.value })}
      />
      {compat && isLocal(draft.baseUrl) && <CorsHint />}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={!canTest || testing} onClick={test}>
          {testing ? "Probando…" : "Probar conexión"}
        </Button>
      </div>
      {status && (
        <p
          role={status.ok ? "status" : "alert"}
          className={`text-sm break-words ${status.ok ? "text-muted-foreground" : "text-destructive"}`}
        >
          {status.text}
        </p>
      )}
      <Models draft={draft} onChange={setDraft} />
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

  return (
    <section id="agent-provider">
      <p className="text-sm font-medium">Proveedor del Agente</p>
      <p className="text-sm text-muted-foreground">
        Las keys viven solo en este navegador y salen directo hacia cada Proveedor.
      </p>
      <p className="text-sm text-muted-foreground">
        Los niveles de aprobación menos estrictos (Revisar para mí, Omitir aprobaciones) aceptan
        riesgo de prompt injection: una nota maliciosa podría hacer que el Agente cambie cosas sin
        preguntarte.
      </p>
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
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                saveAgentSettings(withoutProvider(settings, p.id))
                if (editing?.id === p.id) setEditing(null)
              }}
            >
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
              <Plus />
              {k.name}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}
