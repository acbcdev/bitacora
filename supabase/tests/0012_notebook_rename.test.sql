-- OJO (2026-08-25, ADR 0011): `notebooks_page` YA NO LA LLAMA NADIE. La página de notebooks la
-- arma `derive.notebooksPage` en el cliente, y su cobertura vive en `src/core/store/derive.test.ts`,
-- que corre sin Postgres. Este archivo sigue acá porque la función sigue en la DB (retirarla es
-- una migración), pero verde acá NO significa que la app funcione.
--
-- Test de notebooks_page (creada en 0006, renombrada en 0012 — ADR 0014). Sin framework: asserts
-- de plpgsql, revienta en la primera que falle. Correr contra un Postgres vacío y descartable:
--
--   createdb notebooks_page_test
--   psql -d notebooks_page_test -v ON_ERROR_STOP=1 -f supabase/tests/0012_notebook_rename.test.sql
--
-- Cubre lo que TypeScript no puede ver: el ORDER BY por CASE (los cuatro sorts + los
-- desempates), rondas = min de repasos contando las notas nunca leídas, y que total_count
-- respete el filtro en vez de contar sólo la página.

-- Tablas mínimas (sin auth/RLS: la RPC no las referencia, el aislamiento lo da la policy).
create table courses (
  id uuid primary key default gen_random_uuid(), user_id uuid, name text not null,
  status text not null default 'active', started_at timestamptz, finished_at timestamptz,
  source text, area text, imported boolean not null default false,
  deleted_at timestamptz, created_at timestamptz not null default now(), icon text
);
create table notes (
  id uuid primary key default gen_random_uuid(), user_id uuid, course_id uuid references courses (id),
  title text default '', kind text not null default 'note', position int default 0,
  deleted_at timestamptz, created_at timestamptz not null default now()
);
create table read_log (
  id uuid primary key default gen_random_uuid(), user_id uuid,
  note_id uuid not null references notes (id), read_at timestamptz not null default now()
);
create index notes_course_id_idx on notes (course_id);  -- 0001, 0012 lo renombra
-- Sin auth/RLS reales (no hay auth.uid()), pero la policy de 0002 existe con este nombre y
-- 0012 la renombra — la recreamos tal cual para que el rename aplique.
alter table courses enable row level security;
create policy courses_owner on courses for all using (true) with check (true);

-- \ir = relativo a este archivo, no al cwd del que corre psql.
-- review_queue + course_progress (0003), que 0012 también toca.
\ir ../migrations/0003_derived_queries.sql
\ir ../migrations/0006_courses_page.sql
-- 0007 pisa el ORDER BY de 'recientes' (created_at en vez de last_read) sobre la misma función.
\ir ../migrations/0007_courses_page_recientes_created.sql
-- 0008 agrega started_at desc como desempate de 'recientes' para empates de created_at (imports).
\ir ../migrations/0008_courses_page_created_at_tiebreak.sql
-- 0009 pisa 0007/0008: 'recientes' pasa a ordenar por started_at (mismo criterio que 'inicio'),
-- created_at no sirve para los importados (todos comparten la hora del batch).
\ir ../migrations/0009_courses_page_recientes_started_at.sql
-- 0012 renombra todo a notebooks (ADR 0014): tabla, columna, función y agrego RPCs nuevas.
\ir ../migrations/0012_notebook_rename.sql

-- Fixtures. Los ids son fijos para poder afirmar sobre ellos.
insert into notebooks (id, name, status, started_at, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'Alfa',  'active', '2026-01-05', '2026-01-01'),
  ('00000000-0000-0000-0000-00000000000b', 'Beta',  'paused', '2026-03-05', '2026-01-02'),
  ('00000000-0000-0000-0000-00000000000c', 'Gamma', 'done',   null,         '2026-01-03'),
  ('00000000-0000-0000-0000-00000000000d', 'Delta', 'active', '2026-02-05', '2026-01-04'),
  -- "Importados": created_at reciente (fecha del import) pero started_at es lo que manda.
  ('00000000-0000-0000-0000-00000000000e', 'Epsilon', 'active', '2026-04-01', '2026-05-01'),
  ('00000000-0000-0000-0000-00000000000f', 'Zeta',    'active', '2026-04-20', '2026-05-02');

-- Alfa: 2 notas, una leída 3 veces y otra 1 → rondas = 1 (la menos repasada manda).
-- Beta: 2 notas, una leída 2 veces y otra NUNCA → rondas = 0 (no ignorar la no leída).
-- Gamma: 0 notas → notas 0, rondas 0, last_read null.
-- Delta: 1 nota borrada + 1 flashcard → ninguna cuenta, notas = 0.
insert into notes (id, notebook_id, kind, deleted_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'note', null),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'note', null),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'note', null),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', 'note', null),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000d', 'note', now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000d', 'flashcard', null);

insert into read_log (note_id, read_at) values
  ('00000000-0000-0000-0000-0000000000a1', '2026-05-01'),
  ('00000000-0000-0000-0000-0000000000a1', '2026-05-02'),
  ('00000000-0000-0000-0000-0000000000a1', '2026-05-03'),
  ('00000000-0000-0000-0000-0000000000a2', '2026-06-10'),
  ('00000000-0000-0000-0000-0000000000b1', '2026-07-01'),
  ('00000000-0000-0000-0000-0000000000b1', '2026-07-02');

do $$
declare r record; got text; begin
  -- Agregados por notebook.
  select string_agg(name || ':' || notes || '/' || rounds || '/' || coalesce(last_read::date::text, '-'), ' ' order by name)
    into got from notebooks_page(sort => 'nombre', page_size => 10);
  assert got = 'Alfa:2/1/2026-06-10 Beta:2/0/2026-07-02 Delta:0/0/- Epsilon:0/0/- Gamma:0/0/- Zeta:0/0/-',
    'agregados: ' || got;

  -- Orden por nombre.
  select string_agg(name, ',' ) into got from (select name from notebooks_page(sort => 'nombre', page_size => 10)) t;
  assert got = 'Alfa,Beta,Delta,Epsilon,Gamma,Zeta', 'sort nombre: ' || got;

  -- Orden por rondas desc; empates a 0 desempatan por created_at desc (Zeta 05-02 > Epsilon 05-01).
  select string_agg(name, ',') into got from (select name from notebooks_page(sort => 'rondas', page_size => 10)) t;
  assert got = 'Alfa,Zeta,Epsilon,Delta,Gamma,Beta', 'sort rondas: ' || got;

  -- Orden por inicio desc, nulls last (Gamma no tiene started_at).
  select string_agg(name, ',') into got from (select name from notebooks_page(sort => 'inicio', page_size => 10)) t;
  assert got = 'Zeta,Epsilon,Beta,Delta,Alfa,Gamma', 'sort inicio: ' || got;

  -- Orden por started_at desc (0009): mismo criterio que 'inicio', no created_at — Epsilon y
  -- Zeta son "importados" con created_at reciente pero eso no debe pesar en el orden.
  select string_agg(name, ',') into got from (select name from notebooks_page(sort => 'recientes', page_size => 10)) t;
  assert got = 'Zeta,Epsilon,Beta,Delta,Alfa,Gamma', 'sort recientes: ' || got;

  -- Search case-insensitive y parcial ("et" matchea Beta y Zeta); sin sort explícito usa el
  -- default 'recientes'.
  select string_agg(name, ',') into got from (select name from notebooks_page(q => 'ET', page_size => 10)) t;
  assert got = 'Zeta,Beta', 'search: ' || got;

  -- Filtro de estado.
  select string_agg(name, ',') into got from (select name from notebooks_page(status_filter => 'active', sort => 'nombre', page_size => 10)) t;
  assert got = 'Alfa,Delta,Epsilon,Zeta', 'status: ' || got;

  -- total_count = total filtrado, no el de la página.
  select string_agg(name || '=' || total_count, ',') into got
    from (select name, total_count from notebooks_page(sort => 'nombre', page_size => 2, page_offset => 0)) t;
  assert got = 'Alfa=6,Beta=6', 'page 1: ' || got;
  select string_agg(name || '=' || total_count, ',') into got
    from (select name, total_count from notebooks_page(sort => 'nombre', page_size => 2, page_offset => 2)) t;
  assert got = 'Delta=6,Epsilon=6', 'page 2: ' || got;

  -- total_count respeta el filtro.
  select coalesce(max(total_count), 0)::text into got from notebooks_page(status_filter => 'active', page_size => 2);
  assert got = '4', 'total filtrado: ' || got;

  -- Notebook borrado desaparece.
  update notebooks set deleted_at = now() where name = 'Alfa';
  select string_agg(name, ',') into got from (select name from notebooks_page(sort => 'nombre', page_size => 10)) t;
  assert got = 'Beta,Delta,Epsilon,Gamma,Zeta', 'soft delete: ' || got;

  raise notice 'OK — todas las asserts pasaron';
end $$;
