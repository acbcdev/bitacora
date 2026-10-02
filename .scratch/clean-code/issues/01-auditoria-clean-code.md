# Auditoría clean-code: hallazgos con evidencia

**Status:** resolved

## Objetivo

Producir la lista de hallazgos de legibilidad/simplicidad sobre el código propio, **sin tocar código**. Este issue
alimenta el backlog real del goal: cada hallazgo nace como issue propio (02, 03, …) o queda marcado `wontfix` con su
razón. Sin auditoría no hay refactor — "está desprolijo" no arranca nada.

## Pasos

1. **Estado de partida** (registra la salida en el issue): `pnpm lint`, `pnpm typecheck`, `pnpm test`. Si algo arranca
   rojo, ese hallazgo va primero.
2. **Pasada por el orden del spec** (`src/core/store/` → `src/core/components/` → pantallas). Por archivo de >250 líneas
   en `core/components`, nombre qué mezcla (menú de bloques, tabla, imagen — patrón del hygiene #04).
3. Cada hallazgo con: archivo + símbolo, evidencia (duplicación real / nombre que miente / responsabilidad mezclada /
   código muerto / abstracción de una sola implementación), y labor sugerida de una línea.
4. Clasificar: `ready-for-agent` si es mecánico y previsible; `needs-triage` si cambia firmas o cruza el seam `Store`.

## Criterio

- Cero diffs de código en este issue — solo el informe.
- Hallazgo sin evidencia concreta → `wontfix`, no entra a issues.
- Los hallazgos ya vivos en `.scratch/project-hygiene/` (p.ej. #04 block-controls) se referencian, no se duplican.

## Comentarios

### 2026-10-01 — Auditoría corrida (resolved)

**Estado de partida: TODO en verde.** `pnpm lint` sin salida (deny-warnings), `pnpm typecheck` limpio,
`pnpm test` 45 archivos / 287 tests OK (22s). No hay hallazgo "arranca rojo".

**Pasada por el orden del spec.** El seam (`src/core/store/`) y `snapshot.ts` están bien: módulos
profundos, comentarios con ADR real, la derivación compartida por los dos adapters. El volumen real
de problemas está en componentes duplicados entre sí y en comentarios que sobrevivieron a su código.

Hallazgos con evidencia (cada uno = issue propio, salvo los `wontfix`):

| #   | Hallazgo                                                          | Archivo + evidencia                                                                                                                                                                                                                                      | Clasificación                                                                                                                   |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Comentarios que mienten / muertos                                 | `notebooks.tsx:26-27` dice que la RPC `notebooks_page` resuelve filtros/orden/paginado — la RPC ya no se llama, lo hace `derive.notebooksPage` (comentario propio en derive.ts). `habit-tiles.tsx:30` comenta un `SLOT` que ya no existe en ningún lado. | ready-for-agent → **issue 02**                                                                                                  |
| 2   | Duplicación real: toggle "Marcar finalizado/Reabrir notebook"     | `sidebar.tsx:265-272` y `notebook.tsx:249-258` arman el mismo payload (`status done↔active` + `finished_at`) y los mismos labels/íconos; además el ítem "Fijar/Desfijar" está duplicado en los dos.                                                      | ready-for-agent → **issue 03**                                                                                                  |
| 3   | Duplicación real: upload de imagen + toast                        | `editor.tsx:196-212` (handlePaste) y `slash-menu.tsx:125-146` (ítem Imagen) repiten `store.uploadNoteImage(file)` + el mismo `toast.promise` con textos idénticos ("Subiendo imagen…", "Imagen insertada", mismo error).                                 | ready-for-agent → **issue 04**                                                                                                  |
| 4   | Duplicación interna: popovers color/highlight en bubble-menu      | `bubble-menu.tsx` ~340-395: los dos bloques `<Popover>` difieren sólo en `kind`/accessor; `PaletteGrid`+`ClearButton` ya están extraídos, la envoltura quedó duplicada (~30 líneas ×2).                                                                  | ready-for-agent → **issue 05**                                                                                                  |
| 5   | Código muerto + test que vive del lado equivocado                 | `types.ts:59` `EMPTY_SNAPSHOT` con cero callers (grep total). `stats.test.ts` vive en `src/core/lib/` pero testea `derive.ts`; y existe sólo porque `deriveReadStats` (derive.ts:229) es un wrapper exportado que en producción no lo llama nadie.       | ready-for-agent → **issue 06**                                                                                                  |
| 6   | Duplicación de autosave: note-dialog re-implementa `useNoteDraft` | `note-dialog.tsx:41-70` re-arma el debounce de guardado (pending ref + timer 800ms + flush) que `useNoteDraft` (notes.api.ts) ya resuelve con la misma constante 800 y el mismo `useUpdateNote`.                                                         | needs-triage (unifica el camino de guardado del dialog; riesgo de cambiar el flujo del gate) → **issue 07**                     |
| 7   | Inversión de dependencia: core → pantalla                         | `sidebar.tsx:16-18` importa `@/notebooks/notebook-icon`, `notebooks.api`, `pinned-notebooks` — core/components depende de un feature de pantalla.                                                                                                        | needs-triage (mover módulos de lugar) → **issue 08**                                                                            |
| 8   | Array paralelo por índice                                         | `bubble-menu.tsx` `TurnBlockIcon`: segundo array de íconos alineado por posición con `BLOCKS`; si se reordena BLOCKS, los íconos mienten. El ícono pertenece a la entrada `BlockKind`.                                                                   | ready-for-agent → **issue 09**                                                                                                  |
| 9   | Nombre con typo: `Drialog`                                        | `src/core/ui/drialog.tsx` (custom, no shadcn) exporta `Drialog*` y 6 archivos lo consumen; el nombre se lee como "Dialog" mal escrito.                                                                                                                   | **wontfix** en esta pasada — el spec excluye `src/core/ui/`; apuntado para la próxima que toque ese directorio                  |
| 10  | Shim de re-exports en `habits.ts`                                 | Re-exporta 9 símbolos de `derive.ts`.                                                                                                                                                                                                                    | **wontfix** — es una fachada declarada con su razón escrita ("este es el módulo que la consume"); borrarla sólo mudaría imports |

Ya vivos en hygiene (referenciados, no duplicados): **#04** (split block-controls, 826 líneas, mismas tres
responsabilidades confirmadas) y **#07** (lazy-load `preset-icons.ts` 1533 + `emojis.ts` 1339 — confirmado
que sólo los consume `icon-picker.tsx`).

Lo que NO entró (sin evidencia concreta): `editor.tsx`, `slash-menu.tsx`, `table-controls.tsx`,
`sidebar.tsx`, `icon-picker.tsx`, `habits-dialog.tsx`, `note.tsx`, `review*.ts(x)`, `settings.tsx`,
`snapshot.ts` — cada uno tiene una sola responsabilidad, nombres del dominio y comentarios que explican
decisiones, no ornamentan.
