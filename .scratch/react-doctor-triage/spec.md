# React Doctor — pendientes del triage 2026-09-08

Triage completo de react-doctor 0.9.13 (score 42 → 45, errores 9 → 7, warnings 53 → 33).
Lo que quedó pendiente está acá para grilling/refactor posterior. Contexto del scan y
rejectiones con evidencia: resumen en la conversación del 2026-09-08.

Status: open

## Resueltos (2026-09-08, segunda pasada)

- **`only-export-components` ×9** — utils a archivos hermanos `.ts`: `command-palette-utils.ts`,
  `editor-lightbox-utils.ts`, `sidebar-groups.ts`, `toggle-variants.ts`, `preset-icons.ts`.
  `badgeVariants`/`buttonVariants`/`tabsListVariants` no se usaban fuera de su archivo → sin export.
- **`no-transition-all` en `editor-lightbox.tsx`** — no era falso positivo: `duration-100` setea
  `transition-duration` y el `transition-property` default de CSS es `all`. Fix: `animation-duration-100`
  (tw-animate-css), que solo setea el timing del keyframe; el fade del lightbox queda idéntico.
- **`artifact-baas-authority-surface`** — falso positivo documentado y acotado en `doctor.config.json`
  (ignore.overrides solo para `dist/assets/*.js`, la regla sigue corriendo en el resto): el campo
  matcheado es `providerId` dentro del SDK de supabase-js (GoTrue/SSO), no del modelo de la app;
  las 5 tablas + storage ya tienen RLS owner-only (migraciones 0002/0010/0004/0005). Cualquier bundle con
  supabase-js dispara la regla; la key publishable es pública por diseño.

- **`supabase-table-missing-rls` ×3** — 0001 ahora habilita RLS al crear las tablas (deny-by-default
  hasta que 0002 agrega las policies); el estado final del schema no cambia.
- **`supabase-rls-policy-risk`** — el fixture del test recreaba `courses_owner` con `for all using (true)`
  solo para que 0012 pudiera renombrarla; corre como superuser (bypasea RLS), así que el cuerpo es
  irrelevante. Ahora es `for select using (true)` (shape permitido explícitamente por la regla).
  Verificado: el test SQL pasa ("OK — todas las asserts pasaron").

## Pendientes con decisión humana

1. **`trustPolicyExclude` puntual** — `@trickfilm400/rollup-plugin-off-main-thread@3.0.0-pre1`
   en `pnpm-workspace.yaml` está excluido a mano (transitiva, pre-release, fork). Revisar si
   hay versión estable upstream o si podemos cortar la dependencia que lo arrastra.

2. **`minimumReleaseAge` a 7 días (10080)** — hoy en 1440 (24 h) porque
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
