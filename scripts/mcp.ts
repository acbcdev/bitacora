// MCP server (stdio) de bitacora: expone las mismas `agentTools` que el Agente del browser.
// Correr: tsx --tsconfig tsconfig.app.json scripts/mcp.ts (registrado con `claude mcp add`).
//
// Sin aprobación propia: cada escritura se aplica directo, la aprobación la pone el cliente MCP
// (Claude Code pregunta por tool call). Solo datos de modo Supabase; el modo local vive en el
// localStorage del browser y acá no existe.
//
// stdout es el canal del protocolo: todo log va a stderr.
import { createClient } from "@supabase/supabase-js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { agentTools } from "@/agent/tools"
import type { AgentView } from "@/core/agent/tool"
import type { Database } from "@/core/types/database"

process.loadEnvFile(new URL("../.env", import.meta.url))
const url = process.env.VITE_SUPABASE_URL!
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Sesión real del usuario: el service role solo mintea un magic link y lo canjea. Después todo va
// con RLS y los `default auth.uid()` como en la app, sin inyectar `user_id` tabla por tabla.
// ponytail: toma el único usuario del proyecto; con un segundo usuario real, pedir el email por env.
const admin = createClient(url, service, { auth: { persistSession: false } })
const { data: users, error: usersError } = await admin.auth.admin.listUsers()
if (usersError || !users.users[0]?.email) throw usersError ?? new Error("Sin usuarios")
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: users.users[0].email,
})
if (linkError) throw linkError

const db = createClient<Database>(url, anon, { auth: { persistSession: false } })
const { error: otpError } = await db.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: "magiclink",
})
if (otpError) throw otpError

const must = <T>(r: { data: T | null; error: unknown }) => {
  if (r.error) throw r.error
  return r.data as T
}

// Espejo de `supabaseStore.snapshot()/note()`: solo filas vivas, notas sin `content`.
const view: AgentView = {
  async snapshot() {
    const [notebooks, notes, reads, habits, habitLog] = await Promise.all([
      db.from("notebooks").select("*").is("deleted_at", null),
      db
        .from("notes")
        .select("id, title, notebook_id, position, kind, created_at, updated_at")
        .is("deleted_at", null),
      db.from("read_log").select("note_id, read_at, grade"),
      db.from("habits").select("*").is("deleted_at", null),
      db.from("habit_log").select("habit_id, day, amount, target"),
    ])
    return {
      notebooks: must(notebooks),
      notes: must(notes),
      reads: must(reads),
      habits: must(habits),
      habitLog: must(habitLog),
    }
  },
  async note(id) {
    return must(await db.from("notes").select("*").eq("id", id).is("deleted_at", null).single())
  },
}

const server = new Server({ name: "bitacora", version: "1.0.0" }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: agentTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.schema as { type: "object" },
    annotations: { readOnlyHint: t.risk === "read", destructiveHint: t.risk === "unsafe" },
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = agentTools.find((t) => t.name === req.params.name)
  const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], isError })
  if (!tool) return text(`Tool desconocida: ${req.params.name}`, true)
  const ctx = { view, now: new Date() }
  const args = req.params.arguments ?? {}
  try {
    if (tool.risk === "read") return text(await tool.run(args, ctx))
    // Mismo apply que `applyProposal`: creación = `before === null` con el id elegido por la tool;
    // habit_log = upsert por (habit_id, day).
    const op = await tool.plan(args, ctx)
    const { id, ...values } = op.after as { id?: string } & Record<string, unknown>
    const create = op.before === null
    const table = db.from(op.entity as "notes")
    const { error } =
      op.entity === "habit_log"
        ? await db.from("habit_log").upsert(op.after as never, { onConflict: "habit_id,day" })
        : create
          ? await table.insert(op.after as never)
          : await table.update(values as never).eq("id", id!)
    if (error) throw error
    return text(op.label)
  } catch (e) {
    return text(e instanceof Error ? e.message : JSON.stringify(e), true)
  }
})

await server.connect(new StdioServerTransport())
console.error("bitacora MCP listo")
