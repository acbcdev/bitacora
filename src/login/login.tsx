import { useState } from "react"
import { Check, CircleAlert, HardDrive, LoaderCircle } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { store } from "@/core/store"
import { setStorageMode } from "@/core/store/mode"

// Supabase devuelve mensajes crudos en inglés. Los conocidos se traducen a qué pasó + qué hacer.
const ERRORS: Record<string, { title: string; hint: string }> = {
  "email rate limit exceeded": {
    title: "Pediste varios links seguidos",
    hint: "Revisá el último que te llegó (mirá spam) o esperá unos minutos.",
  },
}
const FALLBACK = {
  title: "No pudimos enviar el link",
  hint: "Revisá tu conexión e intentá de nuevo.",
}

export function Login() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorCopy = error ? (ERRORS[error] ?? FALLBACK) : null

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await store.auth.signIn(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "")
    } finally {
      setLoading(false)
    }
  }

  return (
    // dvh, no screen: en iOS 100vh incluye la zona bajo la barra del navegador.
    // Mobile apila: panel de marca arriba, form abajo. Desde lg, 50/50 a sangre.
    <div className="fade-in grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-16 bg-hero p-8 sm:p-12 lg:p-16">
        <img src="/favicon.svg" alt="" className="size-16 sm:size-24" />
        <div>
          <h1 className="text-6xl font-semibold tracking-tighter sm:text-8xl">Bitácora</h1>
          <p className="mt-6 max-w-md text-xl text-muted-foreground">
            Tu registro de estudio. Repasá, trackeá, avanzá.
          </p>
        </div>
      </section>

      <section className="flex flex-col justify-center gap-10 p-8 sm:p-12 lg:p-20">
        <div>
          <h2 className="text-4xl font-semibold tracking-tighter sm:text-5xl">Entrá.</h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Te mandamos un link al mail. Sin contraseña.
          </p>
        </div>

        <div className="max-w-lg">
          {sent ? (
            <div className="fade-in flex flex-col gap-3">
              <p className="flex items-center gap-2 text-lg font-medium text-signal">
                <Check className="size-5" />
                Link enviado
              </p>
              <p className="text-base text-fg-secondary">
                Revisá <span className="text-foreground">{email}</span> y abrí el magic link.
              </p>
              <Button
                variant="link"
                className="self-start px-0 text-muted-foreground"
                onClick={() => setSent(false)}
              >
                Usar otro email
              </Button>
            </div>
          ) : (
            <form onSubmit={send}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="email" className="eyebrow">
                    Email
                  </FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="go"
                    aria-invalid={!!error}
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    // text-lg (20px): iOS Safari hace auto-zoom sobre cualquier input < 16px.
                    className="h-14 rounded-full px-6 text-lg"
                  />
                </Field>
                <Button type="submit" size="lg" disabled={loading} className="h-14 px-8 text-base">
                  {loading ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    "Enviar magic link"
                  )}
                </Button>
                {errorCopy && (
                  <div
                    role="alert"
                    className="fade-in flex gap-3 rounded-xl bg-destructive/10 px-5 py-4"
                  >
                    <CircleAlert className="mt-0.5 size-5 text-destructive" />
                    <div className="text-base">
                      <p className="font-medium">{errorCopy.title}</p>
                      <p className="mt-0.5 text-muted-foreground">{errorCopy.hint}</p>
                    </div>
                  </div>
                )}
              </FieldGroup>
            </form>
          )}
        </div>

        <div className="flex max-w-lg items-center gap-4 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>

        {/* La puerta al modo local: vive acá porque resuelve justo el caso de quien todavía no
            tiene cuenta. Recarga (setStorageMode) y arranca contra el navegador. */}
        <div className="flex max-w-lg flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setStorageMode("local")}
            className="h-14 px-8 text-base"
          >
            <HardDrive />
            Probar sin cuenta
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Todo queda guardado en este navegador.
          </p>
        </div>
      </section>
    </div>
  )
}
