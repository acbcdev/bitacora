-- updated_at de notes (spec .scratch/editor-flow, issues 01 + 02): el dato que necesita la
-- selección "última editada" del notebook. La columna no existía — verificado en 0001.

alter table notes add column updated_at timestamptz not null default now();

-- Backfill: las notas existentes "nacieron" en su creación. No hay forma de saber cuándo se
-- editaron por última vez y eso está bien — el default de arriba ya las inicializó en now(),
-- así que esto las lleva a su creación real.
update notes set updated_at = created_at;

-- El autosave del editor (debounce 800ms) y la edición de título la mantienen fresca: el
-- update corre por UPDATE, sin código de app. El adapter de Supabase hace update directo.
create or replace function notes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_updated_at
  before update on notes
  for each row execute function notes_touch_updated_at();
