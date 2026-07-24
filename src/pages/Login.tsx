import { useState } from "react"
import { supabase } from "@/lib/supabase"

export function Login() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) return <p className="p-8">Revisá tu mail: te mandamos el magic link.</p>

  return (
    <form onSubmit={send} className="mx-auto flex max-w-sm flex-col gap-3 p-8">
      <h1 className="text-lg font-semibold">pulpo</h1>
      <input
        type="email"
        required
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border px-3 py-2"
      />
      <button type="submit" className="rounded bg-neutral-900 px-3 py-2 text-white">
        Enviar magic link
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
