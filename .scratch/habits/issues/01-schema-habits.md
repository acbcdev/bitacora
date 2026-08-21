# 01 — Schema: `habits` + `habit_log` + RLS

**Status:** ready-for-agent
**Spec:** `.scratch/habits/spec.md`
**ADR:** `docs/adr/0009-habit-log-por-dia-y-target-congelado.md`
**Blocked by:** ninguno

Migración nueva `supabase/migrations/0010_habits.sql` (no editar migraciones existentes: son
entidades nuevas y ya hay datos propios).

```sql
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  icon text,                                           -- 'lucide:<Nombre>' | URL del bucket
  kind text not null default 'good' check (kind in ('good', 'bad')),
  metric text not null default 'check' check (metric in ('check', 'count', 'time')),
  target int not null default 1 check (target >= 0),   -- en metric 'time', minutos
  period text not null default 'day' check (period in ('day', 'week', 'month')),
  days smallint[] check (days is null or days <@ '{0,1,2,3,4,5,6}'),  -- 0=dom … 6=sáb
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table habit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  habit_id uuid references habits(id) on delete set null,
  day date not null,                                   -- fecha LOCAL del usuario, no UTC
  amount int not null default 1 check (amount >= 0),   -- 0 = no hice nada ese día
  target int not null,                                 -- meta vigente ese día (congela el pct)
  unique (habit_id, day)
);
```

- **`amount` es la única concesión a las 3 métricas**: no hay tabla ni columna por tipo de
  tracking. `metric` vive en `habits` y sólo decide el gesto de la UI.
- **`day` es `date`, no `timestamptz`.** Lo escribe el cliente con el `dayKey` local de
  `core/lib/stats.ts:15-17`. Sin esto vuelve el bug de medianoche que ese archivo ya documenta.
- **`target` en el log congela el pct** — subir la meta no reescribe rachas viejas. El porqué y las
  alternativas descartadas están en el ADR 0009; no re-decidirlo acá.
- **`amount >= 0`, no `> 0`**, y **sin `deleted_at` en `habit_log`**: desmarcar un `check` es
  `amount = 0`. No hay nada que borrar, así que la app sigue sin hacer `DELETE`
  (`CONTEXT.md:56`) sin necesitar soft delete en esta tabla.
- **`unique (habit_id, day)`** es lo que hace que registrar sea un upsert (issue 02).
- **`days` no se usa en ningún cálculo.** Es texto para la vista completa (issue 04). Si aparece en
  una query de derivación, está mal.
- RLS en ambas con `auth.uid() = user_id`, copiando el patrón exacto de `0002_rls.sql` (mismas 4
  policies por tabla que ya usan `courses`/`notes`/`read_log`).
- `on delete set null` en `habit_log.habit_id` — el log sobrevive al hábito (ADR 0002).
- Sin índices, sin RPC: dataset chico (~10 hábitos, ~10 filas/día) y sin ORDER BY/agregado que
  PostgREST no exprese.
- Regenerar tipos (`supabase gen types`) para que `src/core/types/database.ts` tenga `Habit` y
  `HabitLog`, y exportar los alias que ya se estilan ahí (`Grade`, `Note`, …).

## Done cuando

`pnpm typecheck` pasa con los tipos nuevos, un `upsert` con el mismo `(habit_id, day)` actualiza en
vez de duplicar, y un insert desde otro usuario no ve las filas (verificación manual, el repo no
testea RLS).
