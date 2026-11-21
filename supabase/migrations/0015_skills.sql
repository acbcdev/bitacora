-- Skills del Agente (ADR 0028): instrucciones con nombre que el usuario invoca con `/nombre`.
-- Los built-ins viven en código; esta tabla guarda SOLO los overrides (misma `name` que un
-- built-in) y los skills creados por el usuario. "Restaurar" = borrar la fila.
-- Hard delete, a diferencia de notes/habits: no hay historia que proteger, así que no hay deleted_at.

create table skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9-]+$'),  -- slug: es lo que se escribe tras `/`
  description text not null default '',
  prompt text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- RLS, mismo patrón que 0002_rls.sql: una policy "for all" con auth.uid() = user_id.
alter table skills enable row level security;

create policy skills_owner on skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
