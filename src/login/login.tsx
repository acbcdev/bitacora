import { useState } from "react"
import { Check, HardDrive, LoaderCircle } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { store } from "@/core/store"
import { setStorageMode } from "@/core/store/mode"

export function Login() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await store.auth.signIn(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el link")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="fade-in flex w-95 max-w-full flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tighter">Bitácora</h1>
          <p className="mt-2.5 text-base text-muted-foreground">
            Tu registro de estudio. Repasá, trackeá, avanzá.
          </p>
        </div>

        <Card className="gap-5 p-8">
          {sent ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-brand-fg">
                <Check />
                Link enviado
              </p>
              <p className="text-sm text-fg-secondary">
                Revisá {email || "tu mail"} y abrí el magic link.
              </p>
            </>
          ) : (
            <form onSubmit={send}>
              <FieldGroup>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="email" className="eyebrow">
                    Email
                  </FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    required
                    aria-invalid={!!error}
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10"
                  />
                  <FieldError>{error}</FieldError>
                </Field>
                <Button type="submit" size="lg" disabled={loading}>
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
        </Card>

        {/* La puerta al modo local. Vive acá y no sólo en Ajustes porque el caso que resuelve es
            justamente el de alguien que todavía no tiene cuenta: probar la app sin registrarse.
            Recarga (setStorageMode) y arranca contra el navegador. */}
        <div className="flex flex-col gap-3">
          <Button variant="ghost" onClick={() => setStorageMode("local")}>
            <HardDrive />
            Probar sin cuenta — todo en este navegador
          </Button>
          <div className="flex justify-between">
            <span className="mono-dim">Sin contraseña — magic link</span>
          </div>
        </div>
      </div>
    </div>
  )
}
