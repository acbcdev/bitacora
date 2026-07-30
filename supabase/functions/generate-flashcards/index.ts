// Edge Function: genera hasta FLASHCARD_LIMIT flashcards (pregunta/respuesta) desde las notas
// vivas de un curso, vía Claude. La API key vive server-side (nunca en el cliente — CONTEXT.md).
// Esta función solo lee y genera; el cliente inserta cada par como fila en `notes`
// (src/flashcards/flashcards.api.ts) — no hay tabla nueva.
import Anthropic from "npm:@anthropic-ai/sdk@0.70.0"
import { createClient } from "npm:@supabase/supabase-js@2"

const FLASHCARD_LIMIT = 10

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

// ponytail: extractor de texto plano del doc Tiptap, no markdown completo — alcanza para darle
// contexto al LLM. No reusa docToMarkdown (src/core/lib/tiptap-markdown.ts): esa función vive
// en el bundle de Vite con alias @/, esta corre aparte en Deno.
type TiptapNode = { text?: string; content?: TiptapNode[] }
function extractText(node: TiptapNode | undefined): string {
  if (!node) return ""
  if (node.text) return node.text
  return (node.content ?? []).map(extractText).join(" ")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

  try {
    const { course_id } = await req.json()
    if (!course_id) return json({ error: "course_id requerido" }, 400)

    // Cliente con el JWT del usuario (no service_role): RLS filtra las notas por dueño.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    )

    const { data: notes, error: notesError } = await supabase
      .from("notes")
      .select("title, content")
      .eq("course_id", course_id)
      .eq("kind", "note")
      .is("deleted_at", null)
    if (notesError) throw notesError
    if (!notes || notes.length === 0) return json({ error: "El curso no tiene notas" }, 400)

    const notesText = (notes as { title: string; content: TiptapNode }[])
      .map((n) => `## ${n.title}\n${extractText(n.content)}`)
      .join("\n\n")

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") })
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      thinking: { type: "disabled" }, // extracción simple, sin razonamiento profundo
      messages: [
        {
          role: "user",
          content:
            `Generá hasta ${FLASHCARD_LIMIT} flashcards de pregunta/respuesta a partir de estas ` +
            `notas de estudio. Preguntas cortas y puntuales, respuestas directas, en español. ` +
            `Basate solo en el contenido de las notas.\n\n${notesText}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              flashcards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    answer: { type: "string" },
                  },
                  required: ["question", "answer"],
                  additionalProperties: false,
                },
              },
            },
            required: ["flashcards"],
            additionalProperties: false,
          },
        },
      },
    })

    const textBlock = response.content.find((b) => b.type === "text")
    const parsed = textBlock ? JSON.parse(textBlock.text) : { flashcards: [] }
    return json({ flashcards: (parsed.flashcards ?? []).slice(0, FLASHCARD_LIMIT) })
  } catch (err) {
    console.error(err)
    return json({ error: "No se pudieron generar las flashcards" }, 500)
  }
})
