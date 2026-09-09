# To-grill: backlog futuro (editor, hábitos timer, chips, AI widget)

**Status:** backlog — para grillar despues. No es spec, son puntos aparte.
**Origen:** brain dump del usuario 2026-08-30, sin editar. Se clarifica despues.

## Contexto original (verbatim)

> mira add some ideas or bug to do a un file.md para grill future un carrusel para image en los editor cuando hay imagenes hacer mas grande y poder pasar ,,, bug o flash raro en los chips de count clicks rapidos ,,, el editor soporata tablas ? ,,, ai mode un widget para acciones ai ,,, que el timer se guarde para el dia que empezo no cuando terminis como rachas is empieza alas 11:59 y acaa 12:19 que es para el dia que empezo no cuando terminos

5 puntos, separados para grill individual.

---

## 1) Editor — carrusel / lightbox para imagenes

**Idea:** cuando una nota tiene imagenes, poder hacerlas mas grandes y pasar entre ellas (carrusel / lightbox), no solo verlas inline chicas.

**Estado actual verificado:**
- `src/core/components/editor.tsx:52` — `extensions: [StarterKit, CodeBlock, Image]` — solo `Image` de Tiptap, sin lightbox, sin galeria, sin upload. Solo renderiza nodos `image` que ya existen (importados de Notion).
- `scripts/notion-import/blocks-to-tiptap.ts:39` — bloques tipo tabla/callout se aplanan, pero imagenes sí se convierten a nodo `image`.
- No hay `editorProps.handleClickOn` ni componente de galeria. No hay `shadcn/dialog` para imagenes.

**Grill — preguntas antes de spec:**
- ¿Cuantas imagenes por nota en la practica? 59 cursos × 25 notas ≈ 1500 notas, ¿cuantas tienen >1 imagen? Si es raro, un lightbox simple alcanza; carrusel completo es overkill.
- ¿Inline carrusel (dentro del doc) o lightbox overlay (click → modal fullscreen con ←/→)? Lo segundo es mas simple y no toca el schema del doc.
- ¿Swipe en mobile? ¿Teclado ←/→ y Esc?
- ¿Zoom / pan? ¿Caption?
- ¿Donde viven las imagenes? Hoy son URLs externas de Notion-S3. Si se quieren subir nuevas hace falta `store.upload*` + bucket, no solo UI.
- ¿Afecta a las 3 superficies que renderizan nota? `Editor` se usa en: Nota standalone, Nota en curso, dialog de Repaso — el lightbox debe funcionar en las 3 o solo en Nota?

**Costo estimado:** Tier 1-2 — si es solo lightbox overlay con `Dialog` + navegación por índice, es un componente nuevo sin migración. Si incluye upload + carrusel inline, sube a Tier 2-3.

---

## 2) Bug — flash raro en chips de count con clicks rapidos

**Sintoma:** al hacer clicks rapidos en los chips de `count` (habitos `count`), hay un flash / estado intermedio raro.

**Estado actual verificado:**
- `src/habits/habit-tiles.tsx:166-169` — `quick()` hace `today + 1` leyendo `e.state.days[TODAY].amount` (derivado de `habit_log`) y dispara `setDay.mutate({ habit, day: todayKey(), value })`.
- `src/habits/habits.api.ts:42-63` — `useSetDay` es **optimista**: `onMutate` actualiza `SNAPSHOT_KEY.habitLog` en `queryClient` antes del round-trip. El `+1` lee de ese mismo cache, comentario `dos clicks seguidos sumen 2`.
- `src/habits/habit-panel.tsx:92-96` — el panel tambien hace un upsert por cada tap de `+`, sin debounce: `ponytail: un upsert por tap... si el spam molesta, debounce acá`.
- No hay `isPending` ni disable del boton durante mutacion.

**Hipotesis (a confirmar con repro):**
- Race entre `deriveHabit` (que recalcula `total`/`days` desde `habitLog`) y el `onMutate` optimista: entre click 1 y click 2 el `entries` todavia no refleja el primer `value`, asi que el segundo `today + 1` calcula sobre valor viejo → flash 0→1→1→2 o 1→2→1→2.
- O `setDay` invalida `snapshot` y el `derived` parpadea por un frame antes del `onMutate`.
- O el `tick` del timer + re-render de la tira hace latir el `SLOT` del chip (`tabular-nums` ya esta, pero ver `habit-tiles.tsx:358-368`).

**Para grillar:**
- Repro deterministico: ¿cuantos ms entre clicks? ¿con `time` tambien o solo `count`? ¿en `habit-tiles` o en `HabitPanel`?
- ¿Deberia haber debounce / throttle / `isPending` disable? ¿O batch de incrementos en un solo upsert?
- ¿El `+1` deberia calcularse en el `onMutate` leyendo el cache mas reciente (ya lo hace para `target` pero no para `amount`)? Ver `habits.api.ts:46-62`.

**Costo estimado:** Tier 1 — bug fix puro, sin schema. Necesita repro + test `habit-tiles.test` o `habits.api.test` con clicks rapidos.

---

## 3) Editor — ¿soporta tablas?

**Pregunta:** ¿el editor Tiptap actual soporta tablas? ¿Deberia?

**Estado actual verificado:**
- `src/core/components/editor.tsx:52` — `StarterKit.configure({ codeBlock: false }) + CodeBlock + Image` — **no hay `Table` extension**. StarterKit no incluye tablas.
- `src/core/types/database.ts` — `notes.content` es `TiptapDoc` (JSON). Una tabla seria `type: "table"` en ese JSON, hoy no se genera.
- `scripts/notion-import/blocks-to-tiptap.ts:39,118` — las tablas de Notion se **aplanan a texto**, comentario explicito: `Bloques Notion-only sin equivalente (callouts, toggles, tablas...) se aplana.`
- `docs/adr/` — ningun ADR menciona tablas.

**Grill — preguntas antes de spec:**
- ¿Cuantas notas importadas tenian tablas que se perdieron al aplanar? ¿Se necesitan de vuelta o era contenido decorativo?
- ¿Tabla como feature de edicion (crear/editar/borrar filas/columnas) o solo render de tablas importadas?
- Si se agrega `@tiptap/extension-table` + `tableRow` + `tableCell` + `tableHeader`, ¿como se ve en mobile? ¿Scroll horizontal?
- ¿Markdown paste debe soportar `| a | b |` → tabla? Hoy `markdownToDoc` no lo hace.
- ¿Tabla interactiva rompe `ui-principles.md` #3 (chrome minimo) si necesita toolbar de tabla?
- Alternativa barata: renderizar tablas como bloque de codigo / texto preformateado sin extension interactiva.

**Costo estimado:** Tier 2 — agregar 3 extensiones + estilos + tests + re-importar tablas perdidas. No toca DB, pero toca `editor.tsx` + `tiptap-markdown` + estilos `index.css`.

---

## 4) AI mode — widget para acciones AI

**Idea:** un widget/modo AI para acciones con AI (tono, reescribir, resumir, generar flashcards, etc.) — no un sidebar pesado.

**Estado actual verificado:**
- AI ya entro por una sola puerta: `supabase/functions/generate-flashcards` → Claude, key server-side (ADR 0010). Boton en `src/courses/course.tsx:208` "Generar flashcards" solo con `store.canGenerateFlashcards` (requiere Supabase).
- Gateado sigue: **chrome minimo** (`ui-principles.md` #3 + `CONTEXT.md:148-151` + `.scratch/platform-features/to-grill-platform-features.md` Tier 4). El `sidebar de integracion AI` se rechazo por chrome, no por infra.
- `.scratch/platform-features/to-grill-platform-features.md:89-95` — `tonos de nota via AI` ya no necesita decision de arquitectura, reusa la Edge Function, vive en Nota, falta spec.
- No hay widget AI hoy. El editor no tiene botones de tono.

**Grill — preguntas antes de spec:**
- ¿Que acciones exactas? Lista concreta: reescribir con tono X, resumir, expandir, generar flashcards, explicar, traducir. Sin lista no se puede diseñar widget.
- ¿Widget donde? Opciones: (a) bubble menu al seleccionar texto (Tiptap `BubbleMenu`), (b) slash command `/ai`, (c) boton flotante en Nota, (d) command palette `⌘K` con `ai:` prefix. Cada uno tiene costo de chrome distinto.
- ¿Cuantas llamadas tolera el presupuesto? Cada accion = 1 llamada a Claude por Edge Function. ¿Click explicito siempre o auto?
- ¿Debe funcionar en modo local (`localStore`)? Hoy `canGenerateFlashcards` es `false` en local — ¿widget deshabilitado o tambien local?
- ¿Como se guarda el resultado? ¿Reemplaza contenido, inserta al final, o muestra diff?
- ¿Necesita `proyectos[]` / `tonos` custom? Ver `to-grill-platform-features.md` "crear tonos propios".

**Costo estimado:** Tier 2 — reusa `generate-flashcards` infra (no nueva Edge Function si es mismo patron), pero agrega UI + prompts + tests. Bloqueado por decision de chrome, no de infra.

---

## 5) Timer — guardar para el dia que empezo, no cuando termina

**Bug / feature:** si el cronometro de habito `time` empieza a las 23:59 y se pausa a las 00:19, el tiempo debe contar para el dia que **empezo** (23:59), no para el dia que **termino** (00:19). Igual que las rachas. Hoy se guarda para "hoy" al momento de pausar.

**Estado actual verificado:**
- `src/habits/habit-timer.ts:10,144` — `Timer = { habitId: string; startedAt: number }` — guarda `startedAt: Date.now()` en `localStorage["bita-timer"]`.
- `src/habits/habit-tiles.tsx:121-126` — `writePause = (e, t) => { value = pausedValue(e.state.days[TODAY].amount, t); setDay.mutate({ habit: e.h, day: todayKey(), value }) }` — **usa `todayKey()` al pausar**, no `startedAt`.
- `src/habits/habit-tiles.tsx:146-149` — `useEffect([reached])` auto-pausa al llegar a meta: `writePause(running, timer); finishTimer(...)` — tambien con `todayKey()` implicito.
- `src/habits/habit-panel.tsx:92-96` — no usa timer.
- `src/core/lib/day.ts` — `todayKey()` y `dayKey(day)` generan `YYYY-MM-DD` local. `habit_log.day` es fecha local (ADR 0009), unica por `(habit_id, day)`.
- `docs/adr/0009-habit-log-por-dia-y-target-congelado.md` — `habit_log` una fila por dia, con `target` congelado. Si se atribuye al dia equivocado, la racha y el cumplimiento del periodo se calculan mal.

**Ejemplo concreto del usuario:** `empieza 11:59 → acaba 12:19` (20 min). Hoy: 0 min dia 1 + 20 min dia 2. Esperado: 20 min dia 1 + 0 min dia 2.

**Grill — preguntas antes de spec (decision no trivial):**
- ¿Siempre al dia de `startedAt`? ¿Que pasa si corre 2h y cruza medianoche — todo al dia de inicio o se **parte** (ej. 10 min dia 1 + 110 min dia 2)?
- ¿Que pasa si `startedAt` es 23:59 y el usuario sigue corriendo 3h — sigue contando para ayer aunque ya es mañana? ¿O se corta a medianoche?
- ¿Y si el usuario inicia 00:01 y pausa 00:20 — es el mismo dia, sin problema, pero el `startedAt` sigue siendo hoy, coincide.
- ¿Como se resuelve el `total` base? `pausedValue(amountSec, t)` suma `elapsedSeconds(t)` a `e.state.days[TODAY].amount` — pero si el dia de inicio es ayer, el `amount` base debe ser `days[ayer].amount`, no `days[hoy].amount`. Cambia la lectura del `total`.
- ¿Que pasa con `reached` auto-finish a medianoche? `shown >= target` se evalua contra `running.state.total` (hoy) — si el timer empezo ayer, el `total` de hoy no incluye el tiempo corrido.
- ¿Se guarda `startedDay` explicito en `Timer` (`{ habitId, startedAt, startedDay: "2026-08-30" }`) o se deriva de `startedAt` con `dayKey(new Date(startedAt))`? Local vs UTC importa (ADR 0009: `habit_log.day` es fecha LOCAL).
- Migracion: ¿hay `habit_log` existentes mal atribuidos que corregir? ¿O solo hacia adelante?
- Relacion con `read_log` y rachas de Repaso — ¿mismo criterio para `read_log.read_at`?

**Costo estimado:** Tier 1-2 — sin migracion de schema, pero cambia `habit-timer.ts` + `habit-tiles.tsx:writePause` + `habit-tiles.tsx:reached` + tests en `src/habits/habit-timer.test.ts` y `src/habits/habits.test.ts`. Necesita decision de "partir a medianoche vs todo al dia de inicio" antes de codear.

---

## Lista por prioridad / costo

**Tier 1 — bug, barato, sin spec grande:**
- #5 Timer dia de inicio (bug concreto, ejemplo del usuario, tests existentes)
- #2 Chips flash clicks rapidos (repro + fix optimista)

**Tier 1-2 — UI sin migracion:**
- #1 Editor lightbox/carrusel (si es solo overlay)
- #4 AI widget (reusa Edge Function, pero necesita spec de acciones + decision chrome)

**Tier 2 — extension Tiptap:**
- #3 Tablas en editor (requiere extensiones + estilos + decision mobile)

## Preguntas abiertas (resolver antes de spec)

1. **Imagenes:** ¿lightbox overlay o carrusel inline? ¿Cuantas notas tienen >1 imagen hoy?
2. **Chips:** ¿repro con clicks rapidos en `count` y `time` o solo `count`? ¿Debe deshabilitar boton durante mutacion?
3. **Tablas:** ¿render solo o edicion completa? ¿Cuantas tablas se perdieron en import de Notion?
4. **AI widget:** ¿lista cerrada de acciones? ¿Bubble menu vs slash vs command palette?
5. **Timer:** ¿todo al dia de inicio o partido a medianoche? ¿`startedDay` en `Timer` o derivado de `startedAt`?

## Proximo paso

- Grillar #5 primero (tiene bug report mas preciso: `11:59→12:19` + referencia a rachas) — definir `startedDay` vs `startedAt` y si se parte a medianoche.
- Repro #2 con test de clicks rapidos en `habit-tiles.tsx`.
- Para #1/#3/#4: decidir si entran antes o despues de Tier 1 de `.scratch/platform-features/to-grill-platform-features.md` (mobile Repaso + shortcuts), que sigue siendo lo mas respaldado por ADR 0004.
