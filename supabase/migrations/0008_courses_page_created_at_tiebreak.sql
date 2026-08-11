-- 57 de 58 cursos vienen de un import masivo y comparten el mismo created_at exacto (mismo
-- insert). Sin desempate, ORDER BY created_at desc los deja en orden físico/de plan, sin
-- relación con nada visible en la tarjeta (que muestra started_at) — se ve "desordenado".
-- Agrega started_at desc como segundo criterio: adentro del empate de created_at, gana el que
-- empezó más tarde en la vida real, que es justo lo que la tarjeta muestra.
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
    case when sort = 'nombre'    then f.name       end asc,
    case when sort = 'rondas'    then f.rounds     end desc,
    case when sort = 'inicio'    then f.started_at end desc nulls last,
    f.created_at desc,
    f.started_at desc nulls last
  limit page_size offset page_offset;
$$;
