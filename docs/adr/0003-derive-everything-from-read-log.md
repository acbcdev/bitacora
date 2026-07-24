# ADR 0003 — Todo derivado de `read_log`, nada denormalizado

**Status:** Accepted

## Contexto

La app muestra: progreso del curso (`notas leídas / total`), `read_count` por nota, racha diaria,
"leídas hoy", y la cola de repaso ordenada por antigüedad de lectura. Tentación clásica: guardar
contadores (`read_count`, `progress`) en columnas y mantenerlos al día.

## Decisión

**No guardar ningún agregado.** Todo sale de `COUNT(*)` / `MAX(...)` sobre `read_log` en el
momento de leer.

## Por qué

- **~1.500 notas es dato CHICO.** `COUNT(*)` y `MAX(read_at)` sobre esa tabla son instantáneos.
- Contadores denormalizados introducen el bug clásico de desincronización (el contador miente si
  un insert falla a medias). Derivar no puede desincronizarse: hay una sola fuente de verdad.
- Un solo evento de escritura (`insert into read_log`) alimenta todas las métricas. Menos código,
  menos superficie de error.

## Consecuencias

- Cada pantalla que muestra progreso corre su propia query agregada. Aceptable al volumen actual.
- La cola de repaso se ordena con una subquery correlacionada:

  ```sql
  select n.* from notes n
  join courses c on c.id = n.course_id
  where c.status = 'active' and n.deleted_at is null and c.deleted_at is null
  order by (select max(read_at) from read_log where note_id = n.id) asc nulls first
  limit 3;
  ```

- Si algún día el volumen creciera 100× (no está en el horizonte), se reevalúa. Ver `CONTEXT.md`
  para por qué eso no va a pasar pronto.
