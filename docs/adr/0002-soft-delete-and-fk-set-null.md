# ADR 0002 — Soft delete + FK `ON DELETE SET NULL`

**Status:** Accepted

## Contexto

Borrar cursos y notas no debe destruir datos ni dejar notas huérfanas desapareciendo en silencio.
El historial de repasos (`read_log`) es el registro del hábito y no debe perderse nunca.

## Decisión

- **Soft delete** vía columna `deleted_at timestamptz` en `courses` y `notes`. La app **nunca**
  ejecuta `DELETE`. Toda query filtra `.is('deleted_at', null)`.
- FK real: `notes.course_id references courses(id) on delete set null`.
- `read_log` **nunca se borra** — es el historial de hábito.

## Por qué

- Sin FK, borrar un curso dejaría notas huérfanas que **desaparecen de la UI en silencio** (el
  JOIN las oculta) sin forma de recuperarlas. Se descartó la idea de "FK soft sin constraints".
- Borrar un curso **no toca sus notas**: quedan linkeadas (o con `course_id` null si el curso se
  borra duro alguna vez), desaparecen de la UI por el JOIN, y se restauran juntas al limpiar
  `deleted_at`.

## Consecuencias

- **Toda** query de lectura debe filtrar `deleted_at is null`. Es fácil de olvidar → es el bug
  más probable de esta decisión. Los specs de `courses`/`notes` lo marcan como criterio de
  aceptación.
- La DB acumula filas borradas. Cleanup **manual**, después, desde el SQL editor:
  `delete from notes where deleted_at < now() - interval '30 days'` (idem courses). Sin cron, sin
  Edge Function — los datos son chicos, no urge.
