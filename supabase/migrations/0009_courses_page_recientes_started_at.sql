-- 0007/0008 ordenaban 'recientes' por created_at, con started_at de desempate. Al revés: para
-- los 57 cursos importados, created_at es sólo la hora del batch de import (idéntica para
-- todos) y started_at es la fecha real de la fuente. Para un curso orgánico started_at ya nace
-- igual a created_at (course-form.tsx pone started_at = now() al crear) — así que started_at
-- sirve como señal de "reciente" en los dos casos, y created_at no sirve en ninguno de los dos
-- para los importados. 'recientes' pasa a ser el mismo criterio que 'inicio'.
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
  select
    f.id, f.user_id, f.name, f.status, f.started_at, f.finished_at,
    f.source, f.area, f.icon, f.imported, f.deleted_at, f.created_at,
    f.notes, f.rounds, f.last_read,
    count(*) over () as total_count
  from filtered f
  order by
    case when sort = 'nombre' then f.name end asc,
    case when sort = 'rondas' then f.rounds end desc,
    case when sort in ('inicio', 'recientes') then f.started_at end desc nulls last,
    f.created_at desc
  limit page_size offset page_offset;
$$;
