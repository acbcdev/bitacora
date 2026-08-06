-- Página de la lista de cursos: filtro + orden + agregados + total, todo en una query.
-- SECURITY INVOKER (default) → RLS aplica en courses, notes y read_log.
--
-- Reemplaza tres cosas que la pantalla Cursos hacía en cliente: el ORDER BY por prioridad de
-- status, el `rounds` (min de repasos entre las notas del curso) y el `last_read`. Antes eso
-- exigía bajar note_refs (~1.500 filas) + read_log entero para pintar 24 tarjetas.
--
-- `total_count` viaja repetido en cada fila: es el precio de resolver filtro y conteo en un solo
-- viaje. La alternativa (una RPC aparte para el count) son dos round-trips que pueden discrepar.
create or replace function courses_page(
  q             text default '',
  status_filter text default null,
  sort          text default 'recientes',
  page_size     int  default 24,
  page_offset   int  default 0
)
returns table (
  id          uuid,
  user_id     uuid,
  name        text,
  status      text,
  started_at  timestamptz,
  finished_at timestamptz,
  source      text,
  area        text,
  icon        text,
  imported    boolean,
  deleted_at  timestamptz,
  created_at  timestamptz,
  notes       bigint,
  rounds      bigint,
  last_read   timestamptz,
  total_count bigint
)
language sql stable
as $$
  with reads as (
    select r.note_id, count(*) as cnt, max(r.read_at) as last_read
    from read_log r
    group by r.note_id
  ),
  -- Rondas completas = la nota MENOS repasada marca el pie del grupo (no hay ronda a medias).
  -- Nota nunca leída → coalesce a 0, si no `min` la ignoraría y mentiría hacia arriba.
  note_stats as (
    select
      n.course_id,
      count(*)                 as notes,
      min(coalesce(rd.cnt, 0)) as rounds,
      max(rd.last_read)        as last_read
    from notes n
    left join reads rd on rd.note_id = n.id
    where n.deleted_at is null and n.kind = 'note' and n.course_id is not null
    group by n.course_id
  ),
  filtered as (
    select
      c.*,
      coalesce(s.notes, 0)  as notes,
      coalesce(s.rounds, 0) as rounds,
      s.last_read
    from courses c
    left join note_stats s on s.course_id = c.id
    where c.deleted_at is null
      and (status_filter is null or c.status = status_filter)
      and (q = '' or c.name ilike '%' || q || '%')
  )
  -- Un CASE por criterio: cuando `sort` no matchea, la expresión da null para TODAS las filas y
  -- el ORDER BY sigue de largo al siguiente. Postgres no acepta un ORDER BY parametrizado en una
  -- función `language sql`, y no vale la pena un plpgsql con EXECUTE por cuatro sorts fijos.
  select
    f.id, f.user_id, f.name, f.status, f.started_at, f.finished_at,
    f.source, f.area, f.icon, f.imported, f.deleted_at, f.created_at,
    f.notes, f.rounds, f.last_read,
    count(*) over () as total_count
  from filtered f
  order by
    case when sort = 'nombre'    then f.name       end asc,
    case when sort = 'rondas'    then f.rounds     end desc,
    case when sort = 'inicio'    then f.started_at end desc nulls last,
    case when sort = 'recientes' then f.last_read  end desc nulls last,
    f.created_at desc
  limit page_size offset page_offset;
$$;

-- ilike '%…%' no usa índice. A 59 cursos es un seq scan de nada; si la tabla creciera de verdad,
-- acá va un GIN sobre name con pg_trgm.
