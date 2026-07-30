-- Todo derivado (ADR 0003). Estas funciones corren SECURITY INVOKER (default) → RLS aplica,
-- solo ven las filas del usuario logueado. PostgREST no expresa bien estos ORDER BY / agregados,
-- por eso viven como RPC en vez de armarlas en el cliente.

-- Cola de repaso: notas no borradas, más viejas primero (nunca-leídas primero).
-- El status del curso no filtra: active, paused y finished entran igual.
create or replace function review_queue()
returns setof notes
language sql stable
as $$
  select n.*
  from notes n
  join courses c on c.id = n.course_id
  where n.deleted_at is null
    and c.deleted_at is null
  order by (select max(read_at) from read_log where note_id = n.id) asc nulls first
  limit 3;
$$;

-- Progreso por curso: total de notas vivas y cuántas tienen al menos un repaso.
create or replace function course_progress()
returns table (course_id uuid, total bigint, read bigint)
language sql stable
as $$
  select
    n.course_id,
    count(*) as total,
    count(*) filter (where exists (select 1 from read_log r where r.note_id = n.id)) as read
  from notes n
  where n.deleted_at is null and n.course_id is not null and n.kind = 'note'
  group by n.course_id;
$$;
