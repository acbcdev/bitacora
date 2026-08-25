# To-grill: sistema de retención (flashcards, intercalado, simulación, stats)

**Status:** flashcards **implementadas y en main** (2026-07-30, commit `bcb4267`) — el `spec.md` se
borró al cerrarse; lo que quedó documentado es `docs/adr/0010-flashcards-como-notas-y-edge-function.md`.
Intercalado (Tier 1) **specificado 2026-08-24** (`spec.md`, sin implementar). `proyectos[]` (Tier 3) sigue sin spec.
**Blocked by:** ninguna.

## Contexto original (brain dump del usuario, sin editar)

Idea: sumar un sistema de retención/repaso más completo al loop actual. Componentes mencionados:

- **Preguntas y respuestas / Flashcards** con repetición espaciada (evaluación: Difícil / Bien / Fácil,
  orden aleatorio).
- **Práctica intercalada**: alternar 2-3 temas en una misma sesión (ej. 1h inglés, 1h marketing, 1h
  programación).
- **Simulación**: aplicar el conocimiento en situaciones reales. Cada curso liga a `proyectos[]` donde
  se aplicó lo aprendido (ej. marketing → crear campaña; inglés → conversar; programación → proyecto).
- **Tabla de repaso** por curso/habilidad con columnas: curso, tiempo invertido, número de preguntas,
  errores, % de retención, curso terminado, notas completas, repasos realizados, práctica real.
- **Sistema de colores**: 🟢 correcto, 🟡 parcial, 🔴 incorrecto → requiere repaso.
- **Fórmula de retención**: (respuestas correctas ÷ total preguntas) × 100.
- Fuente: notas tipo Anki/Notion (flujo estudio: leer → apuntar → preguntas → flashcards → repaso
  espaciado → intercalar → aplicar → reflexionar).

## Grill — verificado contra el estado real del repo

**"Repetición espaciada, se podría decir que es lo que tenemos ahora" → falso.**
`review_queue` (`src/review/review.api.ts:7-16`) es FIFO: notas más viejas primero, nunca-leídas
primero, `limit 3`. No hay intervalos crecientes ni grading. Es cola de lectura, no spaced repetition.

**CONTEXT.md:73-84 — solo 3 pantallas** (Repaso, Cursos, Nota). **CONTEXT.md:82-88 — fuera del MVP
explícito**: `stats y gráficos`, textual:

> Si vuelve el impulso hacia sync/stats/goals antes de que el loop diario funcione, es **scope
> creep** — frenarlo con estos datos, no con opinión.

La tabla de 9 columnas pedida (tiempo invertido, % retención, repasos, práctica real...) es
exactamente "stats y gráficos". El propio doc de dominio dice frenar acá salvo que el loop diario
(Repaso/Cursos/Nota) ya esté rodando a diario de verdad — sin confirmar todavía (ver preguntas
abiertas).

**ADR 0003** (`docs/adr/0003-derive-everything-from-read-log.md`): todo derivado de `read_log`, nada
denormalizado, schema frozen a 3 tablas (`courses`, `notes`, `read_log`). `read_log` es
`(note_id, read_at)`, binario — sin campo correcto/incorrecto/dificultad. El "% de retención" pedido
no existe con este schema: requiere romper "schema frozen" a propósito (ADR nuevo), no es gratis.

**Flashcards Q&A ≠ Note actual.** `Note` es un doc Tiptap largo y libre. Flashcard es un par
pregunta/respuesta chico con grading. Meterlo en `notes.content` fuerza el modelo — necesita entidad
nueva. Otra violación consciente de "schema frozen".

**Intercalado** — casi gratis. La cola ya mezcla cursos `active` por antigüedad global (no agrupa por
curso), o sea ya intercala de facto. Feature real: forzar N `course_id` distintos por batch — cambio
chico en el RPC `review_queue`.

**Simulación (`proyectos[]` por curso)** — tabla nueva independiente, no bloqueada técnicamente por
nada de lo anterior, pero es 4ta entidad + necesita UI en algún lado que hoy no existe (solo 3
pantallas documentadas).

## Lista de features, por costo real

**Tier 0 — ya existe, mal nombrado**
Cola FIFO actual. No es "repetición espaciada", es "cola de lectura por antigüedad". Nombrarlo bien
antes de vender una feature que no está.

**Tier 1 — barato, no toca schema frozen**
- Intercalado forzado: `review_queue` garantiza N `course_id` distintos en el batch de 3.

**Tier 2 — HECHO (2026-07-30). Salió por menos de lo estimado acá: 2 columnas, cero tablas nuevas.
Ver "Qué terminó saliendo" abajo + ADR 0010.**
- Flashcards: tabla `flashcards` (course_id, question, answer) + `flashcard_log` (grade:
  dificil/bien/facil, reviewed_at). Algoritmo: **Leitner boxes**, no SM-2 completo — menos código,
  mismo objetivo. Subir a SM-2 solo si se mide que Leitner se queda corto.
- % retención real: derivado de `flashcard_log.grade` (agregado en query, mismo patrón que ADR 0003 —
  no columna guardada).
- ~~Colores 🟢🟡🔴: CSS sobre thresholds de %~~ — **descartado (2026-08-23)**. El % ya se lee solo;
  pintarlo es decoración, no información nueva.

**Tier 3 — feature nueva independiente, 4ta entidad**
- `projects` (course_id, name, applied_at, notes) para "simulación/aplicación real". No bloquea ni es
  bloqueado por Tier 2.

Tier 2 y 3 necesitan ADR propio cada uno — no son "agregar campo", son decisión de arquitectura
nueva contra un doc que dice explícito "schema frozen" y "solo 3 pantallas".

## Preguntas abiertas — resueltas

1. **¿Loop diario ya en uso real, o repo sigue en refactor?** Repo sigue en refactor (confirmado
   por el usuario) — se decide igual seguir con flashcards, override consciente del guardrail de
   CONTEXT.md:86-88, no por error.
2. **¿Qué se arma primero?** Flashcards, no intercalado — el costo de flashcards bajó de "rompe
   schema frozen" (2 tablas nuevas, estimado original) a "2 columnas, 0 tablas nuevas" durante el
   grill, así que pasó a ser la opción más barata Y de mayor payoff. Intercalado queda segundo, sin
   spec todavía.

~~Detalle completo en `spec.md`~~ — ese spec se borró al implementarse. Lo que salió está abajo, y
el porqué en `docs/adr/0010-flashcards-como-notas-y-edge-function.md`.

## Qué terminó saliendo (2026-07-30)

Más barato todavía que el "2 columnas, 0 tablas" del grill — y distinto en un punto:

- **Flashcards = `notes.kind = 'flashcard'`**, title pregunta / content respuesta. Sin tabla nueva,
  sin `flashcard_log`. Entran a `review_queue()` mezcladas con las notas: el intercalado entre notas
  y flashcards salió gratis (el de cursos, Tier 1, sigue pendiente).
- **`read_log.grade`** (`correcto`/`parcial`/`incorrecto`), nullable. Repasar una flashcard es el
  mismo insert de siempre.
- **% de retención** derivado de `grade` (`useRetention`, `src/flashcards/flashcards.api.ts`),
  mostrado como texto en la pantalla Curso.
- **Se generan con AI**, cosa que este grill no había considerado: Edge Function
  `generate-flashcards` → Claude → el cliente inserta las filas. Ahí murió el "$0 literal".
- **Leitner quedó afuera.** La cola sigue siendo por `max(read_at)`. El `grade` ya está guardado, así
  que subir a cajas/intervalos después no pierde historial.

## Próximo paso

- ~~**Intercalado forzado (Tier 1)**~~ — **specificado 2026-08-24**, ver `spec.md`. El grill lo movió
  de sitio: **no hay batch de 3**. La cola pasa a one-by-one y el intercalado deja de ser propiedad
  del batch para ser propiedad de la transición — `review_queue(exclude_course_id, exclude_note_ids)`
  + `seen[]` en el cliente. Se descubrió de paso que `CONTEXT.md` ya describía la feature como si
  existiera (`grep exclude_course_id` daba 3 hits, los 3 en el doc): el diseño estaba escrito, el
  código no. Falta implementar.
- **`proyectos[]` (Tier 3)** — sin spec, 4ta entidad, sigue sin UI donde vivir.
