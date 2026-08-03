# To-grill: sistema de retención (flashcards, intercalado, simulación, stats)

**Status:** resuelto para flashcards — ver `spec.md` (fase 1, ready-for-agent). Intercalado (Tier 1) y
`proyectos[]` (Tier 3) siguen sin spec.
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

**Tier 2 — rompe schema frozen, necesita ADR nuevo**
- Flashcards: tabla `flashcards` (course_id, question, answer) + `flashcard_log` (grade:
  dificil/bien/facil, reviewed_at). Algoritmo: **Leitner boxes**, no SM-2 completo — menos código,
  mismo objetivo. Subir a SM-2 solo si se mide que Leitner se queda corto.
- % retención real: derivado de `flashcard_log.grade` (agregado en query, mismo patrón que ADR 0003 —
  no columna guardada).
- Colores 🟢🟡🔴: CSS sobre thresholds de %. Trivial, depende de lo anterior.

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

Detalle completo de la arquitectura resuelta (schema, seams, scope) en `spec.md`.

## Próximo paso

Flashcards: implementar contra `spec.md` (`Status: ready-for-agent`). Intercalado (Tier 1) y
`proyectos[]` (Tier 3) siguen sin spec — retomar este doc cuando toque esa fase.
