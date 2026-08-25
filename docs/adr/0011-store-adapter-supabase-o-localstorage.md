# 0011 — El seam `Store`: snapshot + derivación pura, Supabase por default

**Fecha:** 2026-08-25
**Estado:** aceptada
**Reabre:** ADR 0001 (Supabase sobre Turso/D1), ADR 0004 (sin offline-first), ADR 0006 (sin ORM)
**Deja sin llamador:** las RPC `courses_page` (migraciones 0006-0009) y `review_queue` (0003)

## Contexto

Cada `*.api.ts` hablaba PostgREST directo. Eso tenía dos consecuencias medidas:

1. **La superficie de test era el fluent builder de `supabase-js`**, que no es nuestro y es
   profundo. Seis archivos hand-rolleaban un `thenable` falso; `courses.test.tsx` llegaba a
   reimplementar la RPC `courses_page` entera en JS para poder testear la pantalla — dos
   definiciones de "una página de cursos" que podían divergir en silencio.
2. **`createClient` corría en tiempo de import y tira si falta el env.** Clonar el repo sin
   proyecto Supabase no arrancaba ni para mirar la app.

## La primera versión falló, y por qué

El primer intento fue una interfaz `Store` con **un método por query**: `coursesPage`,
`listCourses`, `listNotes`, `listNoteRefs`, `getNote`, `readLog`, `gradedReads`, `listHabits`,
`habitLog`… 22 métodos con **22 call sites, uno a uno**.

Eso no era una abstracción: era una transliteración. El ancho de la interfaz era igual a la
cantidad de queries de la app, o sea igual a su superficie de implementación — la definición de
**módulo shallow**, que es justamente lo que el seam venía a arreglar. Agregar una pantalla
agrandaba el seam y obligaba a escribir el método dos veces, una por adapter.

Peor: con dos implementaciones por operación, **las reglas de negocio se duplicaban**, y
duplicadas divergen. Pasó con el `target` congelado de ADR 0009 — `localStore` respetaba el target
guardado y `supabaseStore` lo pisaba con el del upsert. Nadie lo notó porque el llamador venía
mandando el valor correcto desde la cache; con la cache fría, Supabase reescribía la meta
congelada.

## Decisión

El adapter hace **una sola cosa**: traer las filas vivas y escribirlas. Seis métodos:

```ts
type Store = {
  mode · canGenerateFlashcards · auth
  snapshot(): Promise<Snapshot>          // courses, notes (sin content), reads, habits, habitLog
  note(id): Promise<Note>                // el único que trae el documento Tiptap
  save(entity, input): Promise<Row>
  softDelete(entity, id): Promise<void>
  uploadCourseIcon(file) · generateFlashcards(courseId)
}
```

**Todo lo derivado son funciones puras sobre el `Snapshot`** (`src/core/store/derive.ts`), y las
comparten los dos adapters: `coursesPage`, `reviewQueue`, `retention`, `liveCourses`,
`courseNotes`, `noteRefs`, `frozenTarget`. Una regla de negocio, un lugar. Agregar una pantalla
nueva ya no agranda el seam — agrega una función pura y un `select`.

Dos adapters detrás: **`supabaseStore`** (el default) y **`localStore`** (todo en el navegador,
sobre `localStorage`). El modo se resuelve una vez al arrancar (`mode.ts`): con env, Supabase por
default y local como opt-in explícito; **sin env, local**, para que `git clone && pnpm dev` muestre
la app. Cambiar de modo recarga: las caches están llenas de filas del otro backend y los ids no
significan lo mismo de los dos lados.

## Consecuencias

- **Las RPC `courses_page` y `review_queue` quedan sin llamador.** Siguen en la DB: retirarlas es
  una migración, y una migración es un cambio de DB. Su test SQL (`supabase/tests/`) ya no cubre
  nada que la app ejecute — la cobertura equivalente vive en `derive.test.ts`, que corre sin
  Postgres.
- **Filtrado, orden y paginado de Cursos pasaron al cliente.** A 59 cursos es irrelevante, y
  CONTEXT.md ya lo licencia: *"los datos son CHICOS… cualquier propuesta que asuma volumen grande
  está mal calibrada"*. Esto no es una filosofía nueva: `useReadStats` y `useHabitLog` **ya** se
  bajaban su tabla entera y agregaban en JS. `courses_page` era el outlier.
- **Una sola queryKey (`["snapshot"]`).** Antes eran seis y cada mutation tenía que acordarse de
  cuáles invalidar. El costo, dicho: cualquier escritura refetchea todo. Si algún día pesa, el
  upgrade es paginar el snapshot por tabla, no volver a seis keys.
- **El snapshot no trae `content`.** El documento Tiptap es el 99% del peso de una nota; sólo lo
  necesita la que está abierta, que se pide con `note(id)`. Repaso pasó de recibir 3 notas
  completas a recibir 3 refs y pedir el cuerpo de la que estás mirando.
- **La cola de repaso se congela en el cliente.** Como sale del snapshot y marcar leído lo
  invalida, sin congelarla el batch se reordenaría abajo del usuario en medio del repaso.
  "Cargar más" es el único punto que la descongela.
- **Diferencia consciente entre adapters:** en `reviewQueue`, ante empate de fecha de lectura, la
  versión JS desempata por `created_at` y después por `id`. La RPC no desempataba: el orden lo
  elegía Postgres. Determinista es mejor que fiel a un no-determinismo.
- **Otra, menor:** la RPC leía `total_count` de la primera fila, así que una página fuera de rango
  informaba `total: 0`. `derive.coursesPage` informa el total real siempre.
- El tipo `Session` de `@supabase/supabase-js` ya no cruza el árbol de componentes: `Store.auth`
  devuelve `AuthUser` (`{ email }`), el único campo que la app consumía.
- `getSupabase()` es lazy. `hasSupabaseEnv` es la única lectura del env fuera de él.
- **Lo que el modo local NO puede hacer:** generar flashcards — necesita la Edge Function con la
  API key server-side (ADR 0010). El adapter lo declara con `canGenerateFlashcards: false` y la UI
  esconde el botón: capacidad declarada, no sorpresa en runtime.
- **Techo conocido del modo local:** `localStorage` son ~5 MB. El adapter traduce el
  `QuotaExceededError` a un mensaje que dice qué hacer. Si el modo local pasara a uso serio, la
  salida es IndexedDB — otra decisión, hoy no hace falta.

## Por qué esto no contradice lo que 0001 / 0004 / 0006 cerraron

- **ADR 0004 cierra offline-first y sync engine.** El modo local no es eso: es **excluyente**. O
  hablás con Postgres o con el navegador, nunca con los dos. No hay merge, ni resolución de
  conflictos, ni cola de escrituras pendientes, ni los mismos datos en dos lados.
- **ADR 0006 rechaza el ORM porque bypassea RLS y no tiene dónde correr.** `Store` no genera SQL,
  no mapea entidades y no tiene query builder. El adapter de Supabase sigue siendo `supabase-js`
  hablando PostgREST directo, con RLS aplicando igual. En local no hay servidor ni datos de otro
  usuario que proteger.
- **ADR 0001 descartó SQLite/Dexie/IndexedDB como *el backend*.** Sigue descartado: Supabase es el
  default y lo único que sincroniza entre dispositivos. `localStorage` acá es un modo de prueba.

## Qué lo justificó ahora, y no antes

El grill de `.scratch/platform-features/` lo mandó a Tier 3 con un argumento correcto para su
momento: *"generalizar para un usuario hipotético que no existe"*. Lo que se rechazó era una capa
genérica de storage. Hoy hay tres beneficiarios reales:

1. **Los tests.** Seis fakes de `supabase-js` borrados, incluida la reimplementación de
   `courses_page`. La cobertura de la derivación corre sin Postgres.
2. **`git clone && pnpm dev`.** Antes: throw en tiempo de import. Ahora: la app.
3. **Probar la app sin registrarse** — el caso concreto que la pregunta abierta #3 pedía nombrar
   en vez de "abstracción genérica de storage".

## Alternativa descartada

**Imitar la interfaz de `supabase-js`** (un query builder chainable sobre `localStorage`) para no
tocar ningún `*.api.ts`. Rechazada: reimplementar PostgREST es una superficie enorme de la que
usamos una rebanada, sería frágil, y dejaría los seis fakes de test donde estaban. El costo de
tocar los `*.api.ts` se paga una vez; el de mantener un PostgREST falso, para siempre.
