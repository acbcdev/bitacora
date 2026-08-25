import { localStore } from "@/core/store/local-store"
import { storageMode } from "@/core/store/mode"
import { supabaseStore } from "@/core/store/supabase-store"
import type { Store } from "@/core/store/types"

export { storageMode, setStorageMode } from "@/core/store/mode"
export type { Store, StorageMode } from "@/core/store/types"

// El adapter se elige UNA vez, al arrancar. No es un Context ni un hook: no cambia durante la
// sesión (cambiar de modo recarga — ver `mode.ts`), así que un Provider sólo agregaría ceremonia.
// Los tests mockean este módulo con un objeto plano.
export const store: Store = storageMode() === "local" ? localStore() : supabaseStore()
