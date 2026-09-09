# React Doctor — pendientes del triage 2026-09-08

Triage completo de react-doctor 0.9.13 (score 42 → 45, errores 9 → 7, warnings 53 → 33).
Lo que quedó pendiente está acá para grilling/refactor posterior. Contexto del scan y
rejectiones con evidencia: resumen en la conversación del 2026-09-08.

Status: open

## Pendientes con decisión humana

1. **`only-export-components` ×9** — `src/core/ui/*` (badge, button, tabs, toggle,
   toggle-group, notebook-icon) + `src/core/components/*` (command-palette, editor-lightbox,
   sidebar). Es el patrón shadcn estándar (exportar cva variants junto a componentes). Costo:
   solo Fast Refresh en dev. Decisión: ¿divergimos del patrón shadcn o lo dejamos?

2. **`trustPolicyExclude` puntual** — `@trickfilm400/rollup-plugin-off-main-thread@3.0.0-pre1`
   en `pnpm-workspace.yaml` está excluido a mano (transitiva, pre-release, fork). Revisar si
   hay versión estable upstream o si podemos cortar la dependencia que lo arrastra.

3. **`minimumReleaseAge` a 7 días (10080)** — hoy en 1440 (24 h) porque
   `@tiptap/extension-table@3.31.3` tenía 4 días de publicado y 10080 rompía el install.
   Revisar en ~una semana: subir a 10080 y ver si la lockfile pasa.

## Refactors reales (requieren sesión de diseño, no son mecánicos)

1. **`src/notebooks/notebooks.tsx`** — `no-giant-component` (300+ líneas) + `no-effect-chain`
   ×2 (131, 134: un effect setea `page` que dispara otro effect) + `no-high-complexity` (88).
   Split en componentes más chicos y re-pensar el encadenado de effects.

2. **`src/core/components/image-view.tsx`** — `no-high-complexity` (complejidad 30, cognitiva
   28, función `ImageView`).

3. **`src/habits/habit-tiles.tsx:271`** y **`src/review/review.tsx:71`** — `no-high-complexity`.

4. **`src/notes/notes.api.ts:104`** — `no-adjust-state-on-prop-change`: el effect sincroniza
   `note` → title/doc/savedAt. El fix canónico (ajustar durante render) toca el flow de guardado
   con refs; además un refetch podría pisar tipeo en curso. Requiere decidir el modelo primero.

5. **`src/core/ui/toggle-group.tsx:49`** — `jsx-no-constructed-context-values`: value del
   Context se construye inline. `useMemo` de una línea, pero es archivo vendido de shadcn.

## A11y chicos (vendidos de shadcn o con decisión de UX)

1. **`src/core/ui/item.tsx:11`** — `prefer-tag-over-role`: `role="list"` sobre lo que ya es
   `<ul>`. Sacar el role.

2. **`src/core/ui/pagination.tsx:10`** — `no-redundant-roles`: `role="navigation"` sobre
    `<nav>`. Sacar el role.

3. **`src/notes/note.tsx:171`** — `no-placeholder-only-field`: el título usa placeholder
    "Título" sin label visible. Decisión de diseño: ¿aria-label alcanza o label flotante?

4. **`src/notes/note.tsx:184`** — `no-static-element-interactions`: el `<div className="cursor-text">`
    con onClick para focusear el editor. Fix: `role="button"` + keyboard, o re-think del patrón.

## Observaciones documentadas (no exigir fix)

- `no-array-index-as-key` ×2 en `src/core/components/outline.tsx` (98, 119): botones sin estado,
  lista reconstruida wholesale en cada rescan — el modo de falla de la regla no aplica.
- `no-transition-all` en `editor-lightbox.tsx:107`: falso positivo verificado con grep — no hay
  ninguna propiedad `transition` en el archivo; `duration-100` es config de animación (keyframes).
- `js-flatmap-filter` ×2 en `src/core/lib/tiptap-markdown.ts` (74, 122): no es hot path medido;
  los docs del propio mensaje de la regla piden confirmar con medición antes de meter mano.
- `prefer-module-scope-pure-function` ×4 y `prefer-module-scope-static-value` (outline, dialog,
  drawer, note-actions, note): movers de una línea a module scope, low-value; agrupar en un
  pass de limpieza si se tocan esos archivos por otra cosa.
