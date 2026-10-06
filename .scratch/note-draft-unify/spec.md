# Un solo Borrador de nota: `useNoteDraft` + `NoteBody` sirven a pantalla y diálogo

**Status:** to-do
**Origen:** review `architecture-review-20260929` candidato 2 · grill 2026-10-01 · re-grill 2026-10-05
**Decisión cerrada:** ADR 0021 (extiende ADR 0015) + enmienda 2026-10-05

## Problema

`src/review/note-dialog.tsx` duplica el autosave que ya vive en `useNoteDraft`
(`src/notes/notes.api.ts`): otro timer 800 ms, otro ref `pending`, otro flush al desmontar —
~40 líneas gemelas. Y el "título editable" del ADR obligaría a duplicar también el pegamento
de `NoteEditor` (textarea de título, paste smart, paste global, type-to-focus, ~60 líneas).

## Decidido en el grill

- Un solo hook, **sin flags**: `useNoteDraft(id: string | null, open = true)` →
  `{ note, isLoading, title, savedAt, onTitleChange, onDocChange, flush, getDoc }`.
- **El hook ya pierde tipeo hoy** al cambiar de id (`notes.api.ts:89` solo hace `clearTimeout`;
  el comentario dice "guardar ya"). Se arregla acá, es tarea 0: sin eso el diálogo regresiona.
  El cleanup guarda con el `{id, title, doc}` del draft **saliente**, nunca con `latest.current`
  (ya apunta a la nota nueva).
- **`open` solo dispara flush en el flanco true→false.** El dueño del flush al cerrar es el hook
  (cubre cierres programáticos: borrar, expand). El `id` no cambia al cerrar (el fade-out no se
  vacía). El diálogo solo llama `flush()` antes de `advance` (ADR 0020).
- **`useNote(id)` usa el snapshot como `placeholderData`**: Enter "leído y siguiente" sigue
  instantáneo, sin `NoteSkeleton`. Verificar que el snapshot trae `content` completo.
- **Se extrae `NoteBody({ draft })`** de `note.tsx`: título (textarea, paste smart) + `Editor` +
  paste global + `useTypeToFocus`. `NoteEditor` y `NoteDialog` son solo chrome distinto.
- **El título es siempre editable** en ambas superficies (`DrialogTitle asChild` sobre el
  textarea de `NoteBody`, mantiene el título accesible de Radix). Sin `editableTitle`.
- **type-to-focus activo también en el diálogo**, sin flag. Prerrequisito de teclado:
  J/K bare salen de Repaso → spec propio `.scratch/review-arrow-nav/`. Este spec no depende
  de él (el diálogo nunca tuvo J/K).
- `marked` queda como estado de display (nota ya leída en la sesión, botón "Leído" disabled).
  Se borra el hint "K para la siguiente" del footer del diálogo (no funciona hoy).
- ADR 0015 aplica automáticamente al diálogo.

## Tareas

- [ ] **0.** Test rojo: tipear, cambiar de id antes de los 800 ms → se guarda la nota **saliente**
      con su título/doc. Luego fix en `useNoteDraft` y exponer `flush()`
- [ ] `useNote`: `placeholderData` desde el snapshot (verificar `content` completo)
- [ ] `useNoteDraft(id, open = true)`: flush en flanco `open` true→false
- [ ] Extraer `NoteBody` de `note.tsx`; `NoteEditor` lo consume (comportamiento idéntico)
- [ ] `note-dialog.tsx`: borrar timer/refs/pending (~40 líneas), consumir hook + `NoteBody`,
      título editable, `flush()` antes de `advance`, borrar hint "K"
- [ ] Mover tests del autosave del diálogo a `notes.api` tests (1 regla, 1 suite)
- [ ] Enmendar ADR 0021 (hecho en este grill) y fila **Borrador de nota** de CONTEXT.md (hecho)

## Verificación

`pnpm test src/notes src/review` + `pnpm test` baseline verde. A mano: Enter en Repaso no
parpadea skeleton; tipear y Esc/Enter/borrar no pierde el último tipeo.

## Comments

- 2026-10-05 impl: `placeholderData` desde snapshot **omitido** — el snapshot son `NoteRef` SIN `content`
  (`core/store/types.ts`); sembrar content vacío arriesga que el autosave pise la nota. Review ya
  pide `useNote(id)` y monta el diálogo recién con `openNote`, igual que antes.
  Hint del footer ya decía "→" (spec review-arrow-nav), se conserva.
