import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { HardDrive, LoaderCircle } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { store } from "@/core/store"
import { setStorageMode } from "@/core/store/mode"

export function Login() {
  // El paso vive en la URL (/login?code=<email>, conserva ?next): recargar no pierde el paso y "atrás" vuelve al mail.
  const [params, setParams] = useSearchParams()
  const sent = params.has("code")
  const [email, setEmail] = useState(params.get("code") ?? "")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Un solo submit para los dos pasos: sin código pide el mail, con código lo canjea. Al verificar,
  // onAuthStateChange levanta la sesión y la app sale del Login sola.
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (sent) {
        // Con la sesión, App saca de /login hacia ?next.
        await store.auth.verify(email, code)
      } else {
        await store.auth.signIn(email)
        setParams((p) => {
          p.set("code", email)
          return p
        })
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : sent
            ? "Código inválido"
            : "No se pudo enviar el código",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    // dvh, no screen: en iOS 100vh incluye la zona bajo la barra del navegador y empuja el
    // bloque "Probar sin cuenta" fuera del primer viewport.
    <div className="grid min-h-dvh grid-cols-1 place-items-center px-6 py-10">
      <div className="fade-in flex w-95 max-w-full flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tighter">Bitácora</h1>
          <p className="mt-2.5 text-base text-muted-foreground">
            Tu registro de estudio. Repasá, trackeá, avanzá.
          </p>
        </div>

        {/* h-11 (44px): mínimo de tap target Apple/Google. p-6 en mobile, p-8 desde sm. */}
        <Card className="gap-5 p-6 sm:p-8">
          <form onSubmit={submit}>
            <FieldGroup>
              {sent ? (
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="code" className="eyebrow">
                    Código
                  </FieldLabel>
                  <p className="text-sm text-fg-secondary">Te mandamos un código a {email}.</p>
                  <Input
                    id="code"
                    required
                    autoFocus
                    // one-time-code: iOS/Android lo sugieren desde el mail/SMS sin copiar a mano.
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    // El largo lo define el proyecto (Email OTP Length, 6–10): no lo fijamos acá.
                    pattern="[0-9]{6,10}"
                    maxLength={10}
                    enterKeyHint="go"
                    aria-invalid={!!error}
                    placeholder="Código"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="h-11 text-md tracking-widest"
                  />
                  <FieldError>{error}</FieldError>
                </Field>
              ) : (
                <Field data-invalid={!!error}>
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
                    // text-md (17px): el text-base del DS es 15px y iOS Safari hace auto-zoom
                    // sobre cualquier input < 16px al enfocarlo.
                    className="h-11 text-md"
                  />
                  <FieldError>{error}</FieldError>
                </Field>
              )}
              <Button type="submit" size="lg" disabled={loading} className="h-11">
                {loading ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    {sent ? "Verificando…" : "Enviando…"}
                  </>
                ) : sent ? (
                  "Entrar"
                ) : (
                  "Enviar código"
                )}
              </Button>
              {sent && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setParams(
                      (p) => {
                        p.delete("code")
                        return p
                      },
                      { replace: true },
                    )
                    setCode("")
                    setError(null)
                  }}
                >
                  Usar otro email
                </Button>
              )}
            </FieldGroup>
          </form>
        </Card>

        {/* La puerta al modo local. Vive acá y no sólo en Ajustes porque el caso que resuelve es
            justamente el de alguien que todavía no tiene cuenta: probar la app sin registrarse.
            Recarga (setStorageMode) y arranca contra el navegador. */}
        <Button variant="ghost" onClick={() => setStorageMode("local")} className="h-11">
          <HardDrive />
          Probar sin cuenta — todo en este navegador
        </Button>
      </div>
    </div>
  )
}
