import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { store } from "@/core/store"
import type { Snapshot } from "@/core/store/types"

// Una sola query para todo el estado del servidor. Las pantallas no piden tablas: piden hechos
// derivados del mismo snapshot (`derive.ts`), y TanStack memoiza cada `select`.
//
// Antes había seis queryKeys (`courses`, `notes`, `note_refs`, `read_stats`, `habits`,
// `habit_log`) y cada mutation tenía que acordarse de invalidar las correctas — la de hábitos
// invalidaba `habit_log` pero no `courses`, la de notas invalidaba `notes` y `note_refs`… Con una
// sola key eso deja de ser una decisión.
//
// El costo, dicho: cualquier escritura refetchea todo. A la escala de CONTEXT.md ("los datos son
// CHICOS") es un request de unos cientos de KB; si algún día pesa, el upgrade es paginar el
// snapshot por tabla, no volver a seis keys.
export const SNAPSHOT_KEY = ["snapshot"]

export function useSnapshot<T>(select: (snap: Snapshot) => T) {
  return useQuery({ queryKey: SNAPSHOT_KEY, queryFn: () => store.snapshot(), select })
}

// Toda mutation invalida el snapshot y nada más. `onSuccess` propio si hace falta un toast.
export function useSnapshotMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  options: Omit<UseMutationOptions<TResult, Error, TArgs>, "mutationFn"> = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    ...options,
    onSuccess: (...args) => {
      options.onSuccess?.(...args)
      qc.invalidateQueries({ queryKey: SNAPSHOT_KEY })
    },
  })
}
