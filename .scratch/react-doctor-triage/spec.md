# React Doctor — pendientes del triage 2026-09-08

Triage completo de react-doctor 0.9.13 (score 42 → 45, errores 9 → 7, warnings 53 → 33).
Lo que quedó pendiente está acá para grilling/refactor posterior. Contexto del scan y
rejectiones con evidencia: resumen en la conversación del 2026-09-08.

Status: decided (grilling 2026-09-17) — ejecución pendiente, a cargo de otro agente.
Las decisiones de acá ya están tomadas; no re-grillear. ADR nueva: `docs/adr/0015-draft-de-nota-resetea-por-id.md`.

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

## Decisiones del grilling (2026-09-17) — plan de ejecución

Resueltas una por una en sesión `/grill-with-docs`. Lo que sigue es la spec para el agente que
implementa: mismo orden, mismo alcance, sin re-decidir nada.

1. **`pnpm-workspace.yaml` — `minimumReleaseAge: 1440 → 4320` (3 días).** El bloqueo original
   era `@tiptap/extension-table@3.31.3` con 4 días de publicado; hoy tiene 13 y es la última
   versión. Verificar con `pnpm install` que la lockfile pasa. No subir a 10080 (decisión:
   margen de 7 días innecesario para este repo).

2. **`trustPolicyExclude` del fork — cerrado como documentado.** Verificado en grilling:
   `@trickfilm400/rollup-plugin-off-main-thread@3.0.0-pre1` es dependencia dura de
   `workbox-build` (vía `vite-plugin-pwa`) y NO existe versión estable del upstream — la
   pre-release del fork es la única 3.x que existe. Bajar el ítem a observación; no hay acción.

3. **`notebooks.tsx` — split mecánico + setters (sin rediseño).**
   - Matar los 2 effects marcados (131/134) moviendo los resets a los setters: los tres
     filtros (`q`/`debouncedQ`, `status`, `sort`) pasan por un wrapper que hace
     `setStatus(v); setPage(1); setSelected(0)`; el paginado por un `goToPage(p)` que además
     resetea la selección. El clamp `page > pages` queda como effect.
   - Partir el archivo: tabla y cards a hermanos (`notebook-row`/`notebook-card` o como el
     agente prefiera llamarlos), mismo patrón que los utils del triage
     (`command-palette-utils.ts`, etc.). Misma conducta exacta, cero decisiones de diseño.

4. **`image-view.tsx` — extraer el drag-resize a `image-resize.ts`** (hermano `.ts`). La lógica
   de `onMouseDown` (listeners de window, onMove/onUp, restauración de cursor/userSelect) se
   corta y pega con firma `(startX, startW, side, setDragWidth, updateAttributes)`. Los estilos
   condicionales del `<img>` NO se tocan (decisión: helpers de style/cn oscurecen más de lo que
   ayudan en un componente visual). Sin tests que lo cubran hoy — mismo estado que antes.

5. **`habit-tiles.tsx:271` y `review.tsx:71` — split mecánico en los dos.** El trozo de JSX más
   gordo de cada uno a archivo hermano (candidatos: los dots/paleta de `HabitTile`; la tira de
   hábitos de `Review`) hasta bajar del umbral de `no-high-complexity`. review.tsx es la
   pantalla crítica: tocar sólo lo necesario para bajar el número, sin re-pensar nada (la
   Sesión de repaso ya es deep module, ADR 0012).

6. **`notes.api.ts:104` — el effect pasa de `[note]` a `[note?.id]`.** Ver ADR 0015 completo
   (por qué, trade-offs, qué no cambia). Diff de una línea + comentario en el hook citando el
   ADR. Los tres bugs que mata: tipeo pisado por refetch post-autosave, indicador "Guardado
   HH:MM" que se borra solo, y la regla `no-adjust-state-on-prop-change`.

7. **`toggle-group.tsx:49` — `React.useMemo`** para el value del Provider (una línea). El
   archivo ya está vendido-modificado, el drift ya se paga.

8. **A11y mecánico:** sacar `role="list"` de `item.tsx:11` y `role="navigation"` de
   `pagination.tsx:10` (ambos sobre elementos que ya son semánticamente eso). Y
   `aria-label="Título"` en el textarea de `note.tsx:171`.

9. **A11y 4 (`note.tsx:184`, div `cursor-text`) — suprimir con comentario en
   `doctor.config.json`.** Decisión de semántica: NO es un control, es la zona muerta clickeable
   para poner el cursor (patrón Notion/Docs); un usuario de teclado ya llega al editor con Tab,
   y `role="button"` le anunciaría a un lector de pantalla un botón que no lleva a nada que el
   Tab no alcance. Mismo formato que el override de `artifact-baas-authority-surface`
   (ignore.overrides acotado al archivo, con comentario).

10. **Al terminar:** correr react-doctor y registrar el score nuevo en este spec; todo lo de la
    sección "Observaciones documentadas" de abajo queda como está.

## Ejecución (2026-09-17, mismo día)

Los 10 puntos del plan quedaron implementados. Verificación:

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — limpios.
- Suite completa: 199/201 — los 2 fails son los mismos tests de wall-clock ya conocidos
  (`notebook-create-note` <400ms, `icon-picker` paste <5s), flaky sólo bajo la carga del full
  suite; los dos pasan en isolation.
- **react-doctor 0.9.13: score 47 → 49, issues 22 → 14 (warnings 21 → 10).**

Detalle del delta:

- `notebooks.tsx` — muertos los 2 effects encadenados (setters wrappers: `useNotebookFilters`,
  `goToPage`); el archivo quedó en orquestación y se partió a hermanos:
  `notebook-toolbar.tsx`, `notebook-table.tsx`, `notebook-card.tsx`, `notebook-pagination.tsx`,
  `notebook-row-actions.tsx`, `notebook-hotkeys.ts`, `notebook-filters.ts`,
  `notebook-status.ts`, `notebook-delete-confirm.tsx`, `notebook-empty.tsx`. `no-giant-component`
  y `no-high-complexity` de `Notebooks`: muertos.
- `image-view.tsx` — drag-resize extraído a `image-resize.ts` (`startImageResize`). El complejo
  del `<img>` queda: los estilos condicionales NO se tocan (decisión de grilling). El flag
  `no-high-complexity` de `ImageView` queda en pie — es el precio de esa decisión.
- `habit-tiles.tsx` — `HabitTile` (29/27) bajó bajo umbral con tres hermanos: `habit-dots.tsx`,
  `habit-tile-actions.tsx`, `habit-tile-info.tsx` (que ahora es dueño de `Run`/`LABEL`/`quickLabel`).
- `review.tsx` (19/18) — `ReviewStats` (cabecera con `ReadHistory` adentro, `review-stats.tsx`),
  `ReviewEmpty` (`review-empty.tsx`) y `ReviewNoteDialog` (`review-note-dialog.tsx`). Muerto.
- `notes.api.ts` — effect keyeado a `[note?.id]` con comentario citando ADR 0015. El flag
  `no-adjust-state-on-prop-change` de react-doctor sigue matcheando el shape (no mira el id):
  waiver con evidencia en `doctor.config.json` (junto a `exhaustive-deps`, mismo formato que el
  override de `artifact-baas-authority-surface`).
- `toggle-group.tsx:49` — `useMemo` del value del Provider.
- A11y: `role="list"`/`role="navigation"` fuera; `aria-label="Título"` en el textarea de note.tsx;
  el div `cursor-text` con waiver documentado en `doctor.config.json`.
- `pnpm-workspace.yaml`: `minimumReleaseAge: 4320`, lockfile pasa.

Quedan flags de complexity en `image-view`, `icon-picker` y `notebook.tsx`: los dos últimos son
slides de la ejecución de FieldPill (anterior a esta ejecución, ver su spec) y quedan para esa
iteración; `image-view` es decisión de grilling.

## Pendientes con decisión humana — RESUELTOS (grilling 2026-09-17, ver plan arriba: puntos 1 y 2)

1. **`trustPolicyExclude` puntual** — `@trickfilm400/rollup-plugin-off-main-thread@3.0.0-pre1`
   en `pnpm-workspace.yaml` está excluido a mano (transitiva, pre-release, fork). ~~Revisar si
   hay versión estable upstream o si podemos cortar la dependencia que lo arrastra.~~
   **Resuelto:** es dependencia dura de `workbox-build` y el upstream no tiene 3.x estable —
   cerrado como observación documentada (punto 2 del plan).

2. **`minimumReleaseAge` a 7 días (10080)** — hoy en 1440 (24 h) porque
   `@tiptap/extension-table@3.31.3` tenía 4 días de publicado y 10080 rompía el install.
   ~~Revisar en ~una semana: subir a 10080 y ver si la lockfile pasa.~~
   **Resuelto:** subir a **4320** (3 días), no 10080 — decisión del usuario, margen de 7 días
   innecesario para este repo (punto 1 del plan).

## Refactors reales (decididos en el grilling 2026-09-17, ver plan arriba: puntos 3 a 7)

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

## A11y chicos (decididos en el grilling 2026-09-17, ver plan arriba: puntos 8 y 9)

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
