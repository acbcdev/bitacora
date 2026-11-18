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
    // Mobile: marca arriba, acciones ancladas abajo (zona del pulgar). Desde lg, 50/50 a sangre.
    <div className="fade-in group flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <section className="flex flex-1 flex-col justify-between gap-8 p-6 sm:p-12 lg:bg-hero lg:p-16">
        <img src="/favicon.svg" alt="" className="size-12 sm:size-24" />
        <div>
          <h1 className="text-4xl font-semibold tracking-tighter sm:text-8xl">Bitácora</h1>
          {/* Se oculta al enfocar el input (mobile) para dejarle aire al teclado. */}
          <p className="mt-3 max-w-md text-lg text-muted-foreground transition-opacity duration-200 group-has-[input:focus]:opacity-0 sm:mt-6 sm:text-xl lg:group-has-[input:focus]:opacity-100">
            Tu registro de estudio. Repasá, trackeá, avanzá.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-12 lg:justify-center lg:gap-10 lg:border-t-0 lg:p-20">
        <div>
          <h2 className="text-xl font-semibold tracking-tighter sm:text-5xl">Entrá.</h2>
          <p className="mt-1 text-base text-muted-foreground sm:mt-3 sm:text-lg">
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
                Revisá <span className="break-all text-foreground">{email}</span> y abrí el magic
                link.
              </p>
              <Button
                variant="link"
                className="min-h-11 self-start px-0 text-muted-foreground"
                onClick={() => setSent(false)}
              >
                Usar otro email
              </Button>
            </div>
          ) : (
            <form onSubmit={send}>
              <FieldGroup className="gap-3">
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
                    className="h-14 rounded-pill px-6 text-lg"
                  />
                </Field>
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
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="h-14 px-8 text-base max-md:w-full"
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    "Enviar magic link"
                  )}
                </Button>
              </FieldGroup>
            </form>
          )}
        </div>

        {/* La puerta al modo local: vive acá porque resuelve justo el caso de quien todavía no
            tiene cuenta. Recarga (setStorageMode) y arranca contra el navegador. */}
        <Button
          variant="ghost"
          onClick={() => setStorageMode("local")}
          className="min-h-12 max-w-lg text-base text-fg-secondary"
        >
          <HardDrive />
          Probar sin cuenta · queda en este navegador
        </Button>
      </section>
    </div>
  )
}
