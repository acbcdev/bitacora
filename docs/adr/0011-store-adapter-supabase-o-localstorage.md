# 0011 — El seam `Store`: Supabase por default, `localStorage` como modo excluyente

**Fecha:** 2026-08-25
**Estado:** aceptada
**Reabre:** ADR 0001 (Supabase sobre Turso/D1), ADR 0004 (sin offline-first), ADR 0006 (sin ORM)

## Contexto

Hasta hoy, cada `*.api.ts` hablaba PostgREST directo: `supabase.from("notes").select()...`. Eso
tenía dos consecuencias medibles, no teóricas:

1. **La superficie de test era el fluent builder de `supabase-js`**, que no es nuestro y es
   profundo. Seis archivos de test hand-rolleaban un `thenable` falso imitando
   `.from().select().eq().is().order()` — cada uno un poco distinto, cada uno con su
   `oxlint-disable unicorn/no-thenable` al lado. `courses.test.tsx` llegaba a reimplementar la RPC
   `courses_page` entera en JS para poder testear la pantalla: dos definiciones de "una página de
   cursos" que podían divergir en silencio.
2. **`createClient` corría en tiempo de import y tira si falta el env.** Clonar el repo sin
   proyecto Supabase no arrancaba — ni siquiera para mirar la app.

El pedido original (`.scratch/platform-features/`) era "abstraer la DB para que alguien que no
quiera usar Supabase pueda usar `localStorage`", y se había rechazado con tres ADRs y un
argumento de YAGNI correcto para su momento: generalizar para un usuario hipotético.

## Decisión

Existe una interfaz **`Store`** (`src/core/store/types.ts`) de ~20 métodos, cada uno una operación
del **dominio** (CONTEXT.md) y no un fragmento de SQL: `reviewQueue()`, `markRead()`,
`coursesPage()`, `setHabitDay()`. Detrás hay **dos adapters**:

- **`supabaseStore`** — el default. Mismas RPC, mismo soft delete, mismo upsert que antes.
- **`localStore`** — corre entero en el navegador sobre `localStorage`, sin backend y sin cuenta.

La lógica que en Supabase resuelven las RPC (`courses_page`, `review_queue`) vive en
`src/core/store/derive.ts` como **funciones puras**, y es lo que usa `localStore`. `retention()`
la usan los dos.

El modo se resuelve una vez al arrancar (`src/core/store/mode.ts`):

- Con env de Supabase: **`supabase` por default**; `local` es opt-in explícito (botón en Login,
  toggle en Ajustes), persistido en `localStorage["bita-storage"]`.
- **Sin env de Supabase: `local`**, para que `git clone && pnpm dev` muestre la app.

Cambiar de modo **recarga**. Las caches de React Query están llenas de filas del otro backend y
los ids no significan lo mismo de los dos lados; drenar la cache a mano son veinte líneas y un bug
esperando.

## Por qué esto no contradice lo que 0001 / 0004 / 0006 cerraron

Los tres ADRs siguen vigentes. Lo que se rechazó ahí no es lo que se construyó acá:

- **ADR 0004 cierra offline-first y sync engine.** El modo local **no es** eso: es
  **excluyente**. O hablás con Postgres o con el navegador, nunca con los dos. No hay merge, no
  hay resolución de conflictos, no hay cola de escrituras pendientes, no hay "los mismos datos en
  dos lados". Eso es exactamente el problema que 0004 evita, y sigue evitado.
- **ADR 0006 rechaza el ORM porque bypassea RLS y no tiene dónde correr.** `Store` no es un ORM:
  no genera SQL, no mapea entidades, no tiene query builder. El adapter de Supabase sigue siendo
  `supabase-js` hablando PostgREST directo, con RLS aplicando igual. En modo local no hay servidor
  ni datos de otro usuario que proteger, así que no hay modelo de seguridad que bypassear.
- **ADR 0001 descartó SQLite/Dexie/IndexedDB como *el backend* de la app.** Sigue descartado:
  Supabase es el default y lo único que se sincroniza entre dispositivos. `localStorage` acá es un
  modo de prueba, no un backend candidato.

## Qué lo justificó ahora, y no antes

El argumento de YAGNI que lo frenaba ("generalizás para un usuario que no existe") era correcto
mientras el único beneficiario fuera hipotético. Hoy hay tres beneficiarios reales:

1. **Los tests.** Seis fakes de `supabase-js` borrados. La suite pasó de 135 a 160 tests, y los 25
   nuevos cubren lógica que antes **no se podía testear sin Postgres arriba**.
2. **`git clone && pnpm dev`.** Antes: pantalla en blanco y un throw. Ahora: la app.
3. **Probar la app sin registrarse**, que es el caso concreto que el grill pedía nombrar en vez de
   pedir "una abstracción genérica de storage". Ese es su nombre.

El seam es **real, no hipotético**: la regla es "un adapter = seam hipotético, dos = seam real", y
hay dos.

## Consecuencias

- Los `*.api.ts` quedaron con React Query y nada más. Ninguna pantalla importa `supabase-js`.
- El tipo `Session` de `@supabase/supabase-js` ya no cruza el árbol de componentes: `Store.auth`
  devuelve `AuthUser` (`{ email }`), que es el único campo que la app consumía.
- `getSupabase()` es lazy. `hasSupabaseEnv` es la única lectura del env fuera de él.
- **Lo que el modo local NO puede hacer:** generar flashcards. Necesita la Edge Function con la
  API key server-side (ADR 0010), y sin backend no hay dónde correrla ni dónde esconder la key.
  El adapter lo declara con `canGenerateFlashcards: false` y la UI esconde el botón — capacidad
  declarada, no sorpresa en runtime.
- **Techo conocido del modo local:** `localStorage` son ~5 MB. A 1.500 notas Tiptap eso se puede
  llenar. El adapter traduce el `QuotaExceededError` a un mensaje que dice qué hacer. Si el modo
  local pasara a ser de uso serio, la salida es IndexedDB — pero eso es otra decisión y hoy no
  hace falta.
- **Diferencia consciente entre adapters:** en `reviewQueue`, ante empate de fecha de lectura, la
  versión JS desempata por `created_at` y después por `id`; la RPC no desempata (queda a criterio
  de Postgres). Determinista es mejor que fiel a un no-determinismo.
- `derive.ts` es, además, el **contrato ejecutable** de lo que las RPC prometen. Si algún día
  divergen, `derive.test.ts` lo dice.

## Alternativa descartada

**Imitar la interfaz de `supabase-js`** (un query builder chainable sobre `localStorage`), para no
tocar ningún `*.api.ts`. Rechazada: reimplementar PostgREST es una superficie enorme de la que
usamos una rebanada, sería frágil, y —lo peor— dejaría los seis fakes de test exactamente donde
estaban. El costo de tocar los `*.api.ts` se paga una vez; el de mantener un PostgREST falso, para
siempre.
