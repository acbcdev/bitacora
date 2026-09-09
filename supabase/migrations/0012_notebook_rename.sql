-- Renombre completo Course → Notebook (ADR 0014, spec .scratch/notebook-rename). Un ALTER TABLE
-- RENAME preserva las filas: los contenedores reales y sus notas sobreviven sin transformación.

alter table courses rename to notebooks;
alter table notes rename column course_id to notebook_id;

-- El índice de la FK sigue el vocabulario nuevo (0001).
alter index notes_course_id_idx rename to notes_notebook_id_idx;

-- La policy sigue a la tabla; sólo cambia el nombre.
alter policy courses_owner on notebooks rename to notebooks_owner;

-- El cuerpo de una función NO se actualiza con el rename de la tabla: recrear con el
-- vocabulario nuevo y retirar los nombres viejos (PostgREST expone por nombre).
-- Sin llamador en el cliente (la derivación vive en derive.ts, ADR 0011) — siguen en la DB
-- porque retirarlas es una migración, y esta ya es la migración.
create or replace function review_queue()
returns setof notes
language sql stable
as $$
  select n.*
  from notes n
  join notebooks c on c.id = n.notebook_id
  where n.deleted_at is null
    and c.deleted_at is null
  order by (select max(read_at) from read_log where note_id = n.id) asc nulls first
  limit 3;
$$;

create or replace function notebook_progress()
returns table (notebook_id uuid, total bigint, read bigint)
language sql stable
as $$
  select
    n.notebook_id,
    count(*) as total,
    count(*) filter (where exists (select 1 from read_log r where r.note_id = n.id)) as read
  from notes n
  where n.deleted_at is null and n.notebook_id is not null and n.kind = 'note'
  group by n.notebook_id;
$$;
drop function course_progress();

create or replace function notebooks_page(
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
      n.notebook_id,
      count(*)                 as notes,
      min(coalesce(rd.cnt, 0)) as rounds,
      max(rd.last_read)        as last_read
    from notes n
    left join reads rd on rd.note_id = n.id
    where n.deleted_at is null and n.kind = 'note' and n.notebook_id is not null
    group by n.notebook_id
  ),
  filtered as (
    select
      c.*,
      coalesce(s.notes, 0)  as notes,
      coalesce(s.rounds, 0) as rounds,
      s.last_read
    from notebooks c
    left join note_stats s on s.notebook_id = c.id
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
drop function courses_page(text, text, text, int, int);
