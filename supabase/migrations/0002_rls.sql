-- Aislamiento de datos = 100% RLS (ADR 0001). auth.uid() = user_id en las 3 tablas.
-- Sin sesión, auth.uid() es null → las policies no matchean → 0 filas.

alter table courses  enable row level security;
alter table notes    enable row level security;
alter table read_log enable row level security;

-- Una policy "for all" cubre select/insert/update/delete. using = filas visibles,
-- with check = filas que puedo escribir. Ambas exigen que la fila sea mía.
create policy courses_owner on courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy notes_owner on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy read_log_owner on read_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
