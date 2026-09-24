import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { store } from "@/core/store"
import type { Note } from "@/core/types/database"
import type { NoteRef, Snapshot } from "@/core/store/types"

// Una sola query para todo el estado del servidor. Las pantallas no piden tablas: piden hechos
// derivados del mismo snapshot (`derive.ts`), y TanStack memoiza cada `select`.
//
// Antes había seis queryKeys (`notebooks`, `notes`, `note_refs`, `read_stats`, `habits`,
// `habit_log`) y cada mutation tenía que acordarse de invalidar las correctas — la de hábitos
// invalidaba `habit_log` pero no `notebooks`, la de notas invalidaba `notes` y `note_refs`… Con una
// sola key eso deja de ser una decisión.
//
// El costo, dicho: cualquier escritura refetchea todo. A la escala de CONTEXT.md ("los datos son
// CHICOS") es un request de unos cientos de KB; si algún día pesa, el upgrade es paginar el
// snapshot por tabla, no volver a seis keys.
export const SNAPSHOT_KEY = ["snapshot"]

export function useSnapshot<T>(select: (snap: Snapshot) => T) {
  return useQuery({ queryKey: SNAPSHOT_KEY, queryFn: () => store.snapshot(), select })
}

// Toda mutation pasa por acá. ADR 0008 dice "sembrar, no invalidar": el lugar para cumplirlo es
// este módulo, no cada caller — `SNAPSHOT_KEY` deja de ser un interno conocido y las mutations
// declaran hechos, no escriben el cache:
//
// - `mutationFn` recibe el snapshot que ya está en cache en el instante del mutate (post-sow),
//   así el position de una nota nueva o la fila previa de un +1 no requieren un SELECT.
// - `sow(snap, args)` declara el hecho derivado que el cliente ya puede calcular SIN el server:
//   se siembra en `onMutate` (optimismo de ui-principles 4) y el rollback al fallar lo hace el
//   módulo, no cada caller.
// - Si el server devolvió fila (sólo `notes` la devuelve: WriteResult), el módulo siembra
//   `["note", id]` y el ref en el snapshot — sin esto el editor monta con skeleton y el efecto
//   de auto-corrección de URL rebota a la primera nota (ADR 0008).
// - El `invalidateQueries` queda, pero sin devolver la promesa: refetch de fondo que reconcilia
//   cambios de otro device sin bloquear la navegación.
export function useSnapshotMutation<TArgs, TResult>(
  mutationFn: (args: TArgs, snap: Snapshot | undefined) => Promise<TResult>,
  options: {
    sow?: (snap: Snapshot | undefined, args: TArgs) => Snapshot | undefined
  } & Omit<
    UseMutationOptions<TResult, Error, TArgs, { previous?: Snapshot }>,
    "mutationFn" | "onMutate"
  > = {},
) {
  const qc = useQueryClient()
  const { sow, ...rest } = options
  return useMutation({
    ...rest,
    mutationFn: (args) => mutationFn(args, qc.getQueryData<Snapshot>(SNAPSHOT_KEY)),
    // `sow` corre sobre el cache en el instante del mutate — no sobre la render, que puede estar
    // vieja: dos taps rápidos aún suman 2 (test habits.api "doble tap"). Devuelve el snapshot
    // previo para el rollback.
    onMutate: sow
      ? (args) => {
          const previous = qc.getQueryData<Snapshot>(SNAPSHOT_KEY)
          const next = sow(previous, args)
          if (next && next !== previous) qc.setQueryData(SNAPSHOT_KEY, next)
          return { previous }
        }
      : undefined,
    onError: (error, args, result, ctx) => {
      if (result?.previous) qc.setQueryData(SNAPSHOT_KEY, result.previous)
      rest.onError?.(error, args, result, ctx)
    },
    onSuccess: (data, args, result, ctx) => {
      rest.onSuccess?.(data, args, result, ctx)
      if (isNoteRow(data)) seedNote(qc, data)
      // Sin `await`: nadie navega colgado del refetch (ADR 0008, medido 372ms).
      qc.invalidateQueries({ queryKey: SNAPSHOT_KEY })
    },
  })
}

// WriteResult: sólo `notes` devuelve fila (la recién creada). Si hay fila, su query dependiente
// es `["note", id]` y su ref vive en `snap.notes`. La segunda pasada no doble-cuenta: la fase
// optimista (`sow`) ya dejó su hecho en el cache y el refetch reconcilia.
function isNoteRow(data: unknown): data is Note {
  return !!data && typeof data === "object" && "notebook_id" in data
}

function seedNote(qc: ReturnType<typeof useQueryClient>, note: Note) {
  qc.setQueryData(["note", note.id], note)
  qc.setQueryData<Snapshot>(SNAPSHOT_KEY, (snap) =>
    snap
      ? {
          ...snap,
          notes: [...snap.notes.filter((r) => r.id !== note.id), toRef(note)],
        }
      : snap,
  )
}

const toRef = ({
  id,
  title,
  notebook_id,
  position,
  kind,
  created_at,
  updated_at,
}: Note): NoteRef => ({
  id,
  title,
  notebook_id,
  position,
  kind,
  created_at,
  updated_at,
})
