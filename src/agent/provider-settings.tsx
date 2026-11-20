import { useState } from "react"
import { Button } from "@/core/ui/button"
import { Input } from "@/core/ui/input"
import { DEFAULT_ANTHROPIC_MODEL, saveProvider } from "@/core/agent/provider"
import { useProvider } from "@/agent/use-provider"

// Sección "Proveedor" de Ajustes (v1 tracer: Anthropic, key + modelo). Por dispositivo.
export function ProviderSettings() {
  const saved = useProvider()
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? "")
  const [model, setModel] = useState(saved?.model ?? DEFAULT_ANTHROPIC_MODEL)
  const valid = apiKey.trim() !== "" && model.trim() !== ""

  return (
    <section id="agent-provider">
      <p className="text-sm font-medium">Proveedor del Agente</p>
      <p className="text-sm text-muted-foreground">
        Anthropic. La key vive solo en este navegador y sale directo hacia Anthropic.
      </p>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) saveProvider({ kind: "anthropic", apiKey: apiKey.trim(), model: model.trim() })
        }}
      >
        <Input
          type="password"
          aria-label="API key de Anthropic"
          placeholder="sk-ant-…"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <Input
          aria-label="Modelo"
          placeholder={DEFAULT_ANTHROPIC_MODEL}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={!valid}>
            Guardar
          </Button>
          {saved && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                saveProvider(null)
                setApiKey("")
              }}
            >
              Quitar
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
