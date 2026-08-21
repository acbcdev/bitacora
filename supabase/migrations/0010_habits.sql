-- Hábitos buenos y malos con frecuencia custom (.scratch/habits/spec.md).
-- Dos tablas nuevas: la definición (habits) y el log (habit_log). Migración nueva, no se editan
-- las existentes: ya hay datos propios.

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text,                                           -- 'lucide:<Nombre>' | URL del bucket
  kind text not null default 'good' check (kind in ('good', 'bad')),
  metric text not null default 'check' check (metric in ('check', 'count', 'time')),
  target int not null default 1 check (target >= 0),   -- good = piso, bad = techo; en 'time', minutos
  period text not null default 'day' check (period in ('day', 'week', 'month')),
  -- 0=dom … 6=sáb. RECORDATORIO, no regla: no entra en ningún cálculo (ADR 0009). Si aparece en
  -- una query de derivación, está mal.
  days smallint[] check (days is null or days <@ '{0,1,2,3,4,5,6}'),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Una fila por (habit_id, day) con la meta congelada — ADR 0009. Registrar es un upsert.
create table habit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- El log sobrevive al hábito, igual que notes.course_id (ADR 0002).
  habit_id uuid references habits(id) on delete set null,
  -- date y no timestamptz: lo escribe el cliente con el dayKey local de core/lib/stats.ts. Sin
  -- esto vuelve el bug de medianoche que ese archivo ya documenta.
  day date not null,
  -- 0 = no hice nada ese día (desmarcar un check). Por eso habit_log no lleva deleted_at: no hay
  -- nada que borrar, y la app sigue sin hacer DELETE.
  amount int not null default 1 check (amount >= 0),
  target int not null,                                 -- la meta vigente ese día, congela el pct
  unique (habit_id, day)                               -- lo que hace que registrar sea un upsert
);

-- Sin índices ni RPC: ~10 hábitos y ~10 filas/día, y no hay agregado que PostgREST no exprese.

-- RLS, mismo patrón que 0002_rls.sql: una policy "for all" con auth.uid() = user_id.
alter table habits    enable row level security;
alter table habit_log enable row level security;

create policy habits_owner on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy habit_log_owner on habit_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
