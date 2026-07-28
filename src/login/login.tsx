import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { supabase } from "@/core/lib/supabase"

export function Login() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await supabase.auth.signInWithOtp({ email })
    if (res.error) setError(res.error.message)
    else setSent(true)
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="fade-in flex w-[380px] max-w-full flex-col gap-8">
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
                <Button type="submit" size="lg">
                  Enviar magic link
                </Button>
              </FieldGroup>
            </form>
          )}
        </Card>

        <div className="flex justify-between">
          <span className="mono-dim">Sin contraseña — magic link</span>
          <span className="mono-dim">v0.3</span>
        </div>
      </div>
    </div>
  )
}
