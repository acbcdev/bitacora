# Feature: review

**Blocked by:** foundation, courses, notes

La pantalla que abre 2–3×/día. Cierra el **loop diario**: repasar → marcar leído → siguiente.
Es el corazón de la app.

## Scope

- **Cola de repaso:** notas de cursos `active`, ordenadas por `max(read_at)` ascendente (las más
  viejas primero, las nunca-leídas primero de todas). `limit 3`.
- Pantalla de repaso: nota grande, legible.
- Shortcuts:
  - `Space` = marcar leído (`insert into read_log`) + avanzar a la siguiente.
  - `J` / `K` = saltar sin contar (no toca `read_log`).

## Query de la cola

```sql
select n.* from notes n
join courses c on c.id = n.course_id
where c.status = 'active' and n.deleted_at is null and c.deleted_at is null
order by (select max(read_at) from read_log where note_id = n.id) asc nulls first
limit 3;
```

Ver ADR 0003 (todo derivado de `read_log`).

## Riesgo

`Space` → insert en `read_log` → siguiente es **lógica no trivial con efecto en datos**. El issue
`03` lleva test propio (el handoff pedía `/verify` acá explícitamente).

## Fuera de scope

- Scheduling tipo spaced-repetition / SM-2. Es solo "lo más viejo primero", no un algoritmo de
  memoria. No agregar sin pedido explícito.

## Issues

- `01` query de la cola
- `02` pantalla de repaso
- `03` `Space` marca leído + siguiente; `J`/`K` saltar  ← con test
