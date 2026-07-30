import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/core/lib/supabase"
import type { Grade, TiptapDoc } from "@/core/types/database"

type FlashcardPair = { question: string; answer: string }

function answerDoc(answer: string): TiptapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: answer }] }],
  }
}

// Genera flashcards con AI (Edge Function `generate-flashcards`, supabase/functions) e inserta
// cada par como una nota `kind: 'flashcard'` — mismo shape que una nota normal, sin tabla nueva.
export function useGenerateFlashcards(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ flashcards: FlashcardPair[] }>(
        "generate-flashcards",
        { body: { course_id: courseId } },
      )
      if (error) throw error
      const pairs = data?.flashcards ?? []
      if (pairs.length === 0) return
      const { error: insertError } = await supabase.from("notes").insert(
        pairs.map((p) => ({
          course_id: courseId,
          kind: "flashcard" as const,
          title: p.question,
          content: answerDoc(p.answer),
        })),
      )
      if (insertError) throw insertError
    },
    // Sin onError acá: el MutationCache global (main.tsx) ya avisa con el mensaje real
    // en cualquier mutation que falla — uno propio duplicaría el toast.
    onSuccess: () => {
      toast.success("Flashcards generadas")
      qc.invalidateQueries({ queryKey: ["review_queue"] })
    },
  })
}

// % de retención por curso, derivado de read_log.grade (ADR 0003 — nada denormalizado):
// correcto / total de autoevaluaciones. Dataset chico → se agrega en JS, mismo criterio que
// useReadStats (core/lib/stats.ts).
export function useRetention() {
  return useQuery({
    queryKey: ["retention"],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from("read_log")
        .select("grade, note:notes(course_id)")
        .not("grade", "is", null)
      if (error) throw error
      const rows = data as unknown as { grade: Grade; note: { course_id: string | null } | null }[]
      const totals = new Map<string, { correct: number; total: number }>()
      for (const row of rows) {
        const courseId = row.note?.course_id
        if (!courseId) continue
        const t = totals.get(courseId) ?? { correct: 0, total: 0 }
        t.total++
        if (row.grade === "correcto") t.correct++
        totals.set(courseId, t)
      }
      return new Map([...totals].map(([id, t]) => [id, Math.round((t.correct / t.total) * 100)]))
    },
  })
}
