-- Schema frozen (CONTEXT.md). 3 tablas + FK. Nada denormalizado — todo deriva de read_log (ADR 0003).

create table courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  status      text not null default 'active' check (status in ('active', 'paused', 'done')),
  started_at  timestamptz,
  finished_at timestamptz,
  source      text,                            -- dónde se estudió (ej. 'Platzi'). Texto libre.
  area        text,                            -- tema/categoría del curso. Texto libre, single-value.
  imported    boolean not null default false,  -- fechas estimadas de Notion (CONTEXT.md)
  deleted_at  timestamptz,                     -- soft delete (ADR 0002). La app nunca hace DELETE.
  created_at  timestamptz not null default now()
);

create table notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id  uuid references courses (id) on delete set null,  -- nota huérfana no rompe UI (ADR 0002)
  title      text not null default '',
  content    jsonb not null default '{}'::jsonb,               -- documento Tiptap (JSON)
  position   integer not null default 0,                      -- orden dentro del curso
  imported   boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- read_log: historial de repasos. NUNCA se borra — no tiene deleted_at.
create table read_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references notes (id) on delete cascade,
  read_at timestamptz not null default now()
);

-- Datos chicos (~1.500 notas). Solo los índices de FK que las queries de la app usan de verdad.
create index notes_course_id_idx on notes (course_id);
create index read_log_note_id_idx on read_log (note_id);
