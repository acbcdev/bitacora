# ADR 0028 — Skills persisten en el Store; los built-ins viven en código

**Status:** Accepted (2026-11-20).

Un **Skill** (nombre, descripción, prompt) es dato del usuario: se crea y edita en los ajustes de
AI y sigue al usuario entre dispositivos, así que vive en una tabla `skills` del `Store` (adapters
local y Supabase, migración con RLS), con **hard delete** (a diferencia de notas y hábitos, no hay
historia que proteger). Los Skills por defecto son constantes en código; el `Store` guarda solo los
**overrides** (por nombre) y los creados por el usuario, así "Restaurar" es borrar la fila y un
built-in nuevo en un release llega sin pisar nada.

## Considered Options

- `localStorage` por dispositivo, como la config del **Proveedor**: sin schema, pero el usuario
  perdería sus Skills al cambiar de browser. La config del Proveedor es per-device porque lleva la
  key; un Skill no tiene ese motivo.
- Nota con formato especial: cero tablas, pero acopla los Skills al formato de notas.

## Consecuencias

- Los **Chats** NO entran acá: viven solo en `localStorage` del dispositivo (tope 20, resultados de
  tool truncados), porque son efímeros y pueden contener resultados grandes.
- Tabla nueva = cambios en `types.ts`, `local-store.ts`, `supabase-store.ts` y una migración.
- La UI de edición reusa la **estructura del notebook** (índice + cuerpo estilo nota con autosave de
  800 ms y el `Editor` Tiptap), pero el modelo no cambia: sigue siendo la tabla `skills`, no una
  Nota (la opción "Nota con formato especial" sigue descartada). El prompt se guarda como markdown
  (`docToMarkdown` / `markdownToDoc`), no como documento Tiptap.
- El autosave solo persiste un estado válido (nombre sin error y prompt no vacío): "Nuevo" abre un
  borrador local y la fila nace recién entonces. Los saves van en cola porque `save` no devuelve el
  `id` y un built-in sin override no tiene fila hasta el primero.
