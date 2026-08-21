# 05 — Docs: glosario + cerrar el gate de hábitos

**Status:** ready-for-agent
**Spec:** `.scratch/habits/spec.md`
**Blocked by:** 03

Sin esto el repo queda contradiciéndose: `CONTEXT.md` sigue diciendo que hábitos está gateado
mientras la feature está en pantalla.

## `CONTEXT.md`

- **Glosario** — sumar, con el vocabulario que usa el código (`docs/agents/domain.md`):
  - **`Habit`** — `kind` good/bad, `metric` check/count/time, `target` + `period` = frecuencia.
  - **`habit_log`** — **una fila por hábito por día**, con `amount` (cuánto) y `target` (la meta que
    regía ese día). Registrar es un **upsert**, no un insert. No decir "una fila por evento": eso
    era el modelo viejo.
  - **`target` congelado** — la meta guardada en la fila del log. Es lo que hace que cambiar la meta
    no reescriba las rachas viejas (ADR 0009).
  - **`days`** — los días en que se *planea* hacer el hábito. **Recordatorio, no regla**: no entra
    en ningún cálculo. Un hábito de días fijos se modela como cupo (`count 3/week`).
  - **Cumplimiento** — `good` = piso, `bad` = techo.
  - **Racha de hábito** — períodos consecutivos cumplidos.
  - No decir "meta" ni "goal": `goals` es otra cosa y sigue descartada.
- **Schema (frozen)** — agregar `habits` y `habit_log` al bloque SQL, con `day date` y el `target`
  del log.
- **Nota junto a `read_log`**: `read_log` sigue append-only y sin `target`. `habit_log` es distinto
  a propósito y el porqué está en ADR 0009 — sin esa línea, el próximo que lea las dos tablas va a
  querer "unificarlas".
- **Fuera del MVP** — sacar "seguimiento de hábitos" de la lista de gated y dejar escrito **por qué
  se reabrió**: no es el mismo territorio que `goals` (entidad propia + log propio + hábitos malos,
  nada de eso derivable de `read_log`), y el gate del loop diario se saltó por decisión consciente
  del usuario. Sin esa línea, el próximo grill lo vuelve a marcar como scope creep.

## `docs/adr/`

El ADR **ya está escrito**: `0009-habit-log-por-dia-y-target-congelado.md`. Este issue no lo crea;
sólo verifica que `CONTEXT.md` lo referencie desde el bloque de schema.

## `.scratch/platform-features/to-grill-platform-features.md`

Marcar el ítem Tier 3 "Seguimiento de hábitos" como resuelto, apuntando a `.scratch/habits/spec.md`.
Responde la pregunta abierta #2 de ese doc. La #5 (¿el loop diario está en uso real?) **sigue
abierta** — no cerrarla de arrastre.

## `docs/ui-principles.md`

- Sumar `H` a la convención de teclas: chord `h>1..9` = acción rápida del hábito N, misma familia
  que `g>1..9`. Sin fila nueva para letra bare — `H` bare no existe.
- Dejar anotado que la vista completa de hábitos es un **Dialog**, no una 4ta pantalla, para que la
  regla de "solo 3 pantallas" no se lea como violada.
