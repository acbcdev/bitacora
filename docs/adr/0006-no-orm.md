# ADR 0006 — Sin ORM: `supabase-js` + tipos generados

**Status:** Accepted

## Contexto

Tentación de meter un ORM (Prisma / Drizzle) por type-safety. No encaja con la arquitectura.

## Decisión

**Sin ORM.** La capa de datos es `supabase-js` (query builder sobre PostgREST). Type-safety vía
tipos generados del schema (`supabase gen types typescript`).

## Por qué un ORM no encaja

- **No hay servidor donde correrlo (ADR 0001).** Prisma/Drizzle son capas server-side que
  ejecutan SQL contra un connection string directo a Postgres. El browser habla directo a
  Supabase; un connection string en el cliente = DB entera expuesta (mismo motivo por el que se
  descartó Turso).
- **Bypassa RLS.** El modelo de seguridad es RLS + `auth.uid()` del JWT (ADR 0001). Un ORM se
  conecta como rol privilegiado y saltea las policies salvo gimnasia de `SET LOCAL
  request.jwt.claims` por transacción — que anula el punto.
- `supabase-js` va por RLS con la `anon key` (seguro desde el browser) y es lo que **todos los
  specs ya usan** (`.from('notes').select().is('deleted_at', null)`).

## Type-safety sin ORM

```bash
supabase gen types typescript --project-id <id> > src/types/database.ts
```

```ts
createClient<Database>(url, anonKey)  // queries 100% tipadas, autocomplete
```

## Consecuencias

- Regenerar `database.ts` cada vez que cambia el schema (raro — está frozen).
- **Único caso para reabrir:** si aparece un backend propio (Edge Functions / server). No está en
  scope y contradice ADR 0001. Se reabre ahí, con ese backend concreto sobre la mesa.
