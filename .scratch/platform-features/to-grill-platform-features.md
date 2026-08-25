# To-grill: plataforma (AI sidebar, shortcuts, hábitos, mobile, settings, themes, DB abstraction, tonos de nota)

**Status:** grilling — parcialmente superado por los hechos. Hábitos: **hecho** (2026-08-20).
AI: **el blocker de arquitectura cayó** (2026-07-30, Edge Function `generate-flashcards` + ADR 0010).
**Abstracción DB + Settings: hechos (2026-08-25)** — ver ADR 0011 y el bloque al final.
Siguen sin resolver y sin spec: mobile, más shortcuts, themes (multi-preset), sidebar AI, tonos.
**Relacionado:** [[to-grill-retention-system]] — el ítem "AI genera flashcards" **ya salió**: las
flashcards existen como `notes.kind = 'flashcard'`, generadas con Claude desde el botón de la
pantalla Curso.

## Contexto original (brain dump del usuario, sin editar)

- **Sidebar de integración AI**: extraer/crear información de los datos. Ej: "créame flashcards de
  este curso" o que se generen automático.
- **Más shortcuts.**
- **Sistema de seguimiento de hábitos.**
- **Optimizar para mobile.**
- **Settings.**
- **Themes.**
- **Abstraer la DB**: para que alguien que no quiera usar la DB (Supabase) pueda usar `localStorage`
  en su lugar.
- **En notas: funciones de optimización con botones de tono preestablecido + crear tonos propios**
  (reescribir la nota con AI según tono).

## Grill — verificado contra el estado real del repo

**Themes → parcialmente ya existe.** `app.tsx:64-69` + `sidebar.tsx` ya tienen toggle dark/light
persistido en `localStorage` (`bita-theme`). Si "themes" pedía solo claro/oscuro, ya está. Si pedía
paletas custom más allá de eso, es scope nuevo — choca con ADR 0005 ("sin design system formal") y
con la filosofía de `ui-principles.md` de no construir infraestructura "para después".

**Settings → pantalla nueva, no existe ninguna hoy** (`grep -rni settings src` → 0 resultados).
`ui-principles.md` regla final, textual:

> No pantallas nuevas fuera de las 3 (Repaso, Cursos, Nota) sin reabrir el scope.

Antes de construir: ¿qué necesita vivir en Settings que no sea ya el toggle de tema que está en el
sidebar? Si es poco, no amerita 4ta pantalla — se puede colgar de donde ya vive (sidebar/cursos).

**Sistema de seguimiento de hábitos → choca directo con una decisión ya tomada.** CONTEXT.md:84-88,
textual:

> `goals` se diseñó y descartó a propósito: se mira 1×/semana, es una tabla + CRUD de 2h **después**
> de que el loop diario ande. Si vuelve el impulso hacia sync/stats/goals antes de que el loop diario
> funcione, es **scope creep** — frenarlo con estos datos, no con opinión.

Seguimiento de hábitos y `goals`/metas son el mismo territorio conceptual. Esto no es una feature
nueva, es la misma idea ya evaluada y descartada con otro nombre. Reabrir esto necesita un caso
concreto distinto al que ya se descartó, no una preferencia.

**Optimizar mobile → el único ítem de este batch respaldado por un ADR existente.** ADR 0004
("no offline-first"), textual: "el usuario **repasa en el celular**, online." El caso de uso mobile
ya está documentado como real para la pantalla Repaso — esto no es scope creep, es cerrar una brecha
entre lo que el ADR asume y lo que la UI hoy soporta. Prioridad más alta del batch.

**Abstraer DB para permitir `localStorage` en vez de Supabase → contradice 3 ADRs a la vez:**
- ADR 0001: SQLite local/Dexie/IndexedDB fueron evaluados y rechazados explícitamente ("muertos al
  elegir un backend hosted").
- ADR 0004: "Sin offline-first, sin sync engine" — un storage swap Supabase↔localStorage es
  exactamente el problema de sync que ese ADR cierra a propósito.
- ADR 0006: "Sin ORM" — la seguridad depende 100% de RLS + `supabase-js` hablando directo a
  Postgres. Una capa de abstracción que permita cambiar de backend es la misma clase de indirección
  que ese ADR rechaza, por la misma razón (bypassea el modelo de seguridad, agrega una capa sin
  servidor donde correrla).

Encima: la app es "app personal de gestión de estudio" (CONTEXT.md:1), un solo usuario (vos). Abstraer
el storage "por si alguien más lo quiere usar sin DB" es generalizar para un usuario hipotético que no
existe — el caso de YAGNI más claro de todo el batch. Si el motivo real es "quiero probar la app sin
loguearme"/demo mode, ese es un caso concreto distinto y vale nombrarlo así, no como abstracción
genérica de storage.

**Sidebar de integración AI (generar flashcards automático) → varios problemas simultáneos.
Actualizado 2026-07-30: de los cuatro, dos ya cayeron.**
- ~~Depende de que exista la entidad `flashcards`~~ — **resuelto**: son `notes.kind = 'flashcard'`,
  y ya se generan con AI (botón "Generar flashcards" en la pantalla Curso, `course.tsx:208`).
- `ui-principles.md` regla #3: "Sin sidebars pesadas, sin toolbars llenas de botones que no se usan."
  Un sidebar de AI es chrome adicional — choca directo con "chrome mínimo".
- ~~Costo: "$0, sin servidores propios"~~ — **el $0 literal ya se rompió, a sabiendas** (ADR 0010).
  Sigue valiendo el criterio, no el número: el gasto de hoy es un click explícito por curso. Un
  sidebar AI que dispara llamadas solo es otra cosa — eso sí hay que presupuestarlo.
- ~~Seguridad / backend nuevo: la API key necesita una Edge Function, y eso reabre ADR 0006~~ —
  **hecho**: `supabase/functions/generate-flashcards` corre con la key server-side y con el JWT del
  usuario (RLS sigue aplicando). ADR 0006 se reabrió y se re-decidió: sigue sin ORM. Una feature AI
  nueva ya **no** es decisión de arquitectura, es una función más al lado de la que existe.
- **Lo que sigue en pie es el chrome**: `ui-principles.md` #3, "sin sidebars pesadas". Ese es hoy el
  único blocker real del sidebar AI — y no se resuelve con infra, se resuelve con un caso de uso que
  justifique la superficie.

**Notas — botones de tono preestablecido + tonos propios (AI rewrite).** Escrito originalmente como
"mismo problema de costo y arquitectura que el sidebar AI" (LLM = $, API key necesita backend).
**Actualizado 2026-07-30: el problema de arquitectura ya no existe** — reusa la Edge Function que se
construyó para flashcards. Queda solo el costo, acotado mientras sea un botón explícito. No agrega
pantalla nueva (vive en Nota, una de las 3 ya aprobadas) — menor fricción con `ui-principles.md` en
ese eje. Sí hay que vigilar cuántos botones se agregan al editor: "chrome mínimo" aplica igual ahí
adentro.

**Más shortcuts → sin conflicto, es la regla #1 de `ui-principles.md` tal cual.** Ítem más barato y
más alineado de todo el batch. No necesita grill adicional, necesita lista concreta de qué acciones
todavía no tienen tecla.

## Lista, por costo/conflicto real

**Tier 0 — ya existe**
- Theme claro/oscuro (`app.tsx:64-69`, `sidebar.tsx`). Confirmar si "themes" pedía más que esto.

**Tier 1 — alineado con principios documentados, barato**
- Más shortcuts (ui-principles #1). Falta: inventario de acciones sin tecla.
- Mobile para Repaso — respaldado por ADR 0004 tal cual. Mayor prioridad del batch.

**Tier 2 — reabre scope de pantallas, necesita justificar antes de construir**
- ~~Settings~~ — **HECHO (2026-08-25).** No terminó siendo pantalla: es un `Drialog`. Lo justificó
  el modo de almacenamiento, que necesitaba dónde vivir. Ver el bloque "Resuelto" al final.

**Tier 3 — contradice una decisión ya tomada, no reabrir sin caso nuevo**
- ~~Seguimiento de hábitos~~ — **HECHO. Reabierto con caso nuevo, specificado en
  `.scratch/habits/spec.md` e implementado (2026-08-20): tablas `habits` + `habit_log`
  (`0010_habits.sql`), tiles en Repaso, panel, dialog y cronómetro. Los 6 issues de
  `.scratch/habits/issues/` están en `resuelto`.** No era el mismo territorio que `goals`: entidad propia + log propio
  + hábitos **malos**, nada de eso derivable de `read_log`. Responde la pregunta abierta #2. El
  gate del loop diario (#5) **sigue abierto** — se saltó por decisión consciente del usuario, no
  porque se haya resuelto.
- ~~Abstracción DB → localStorage~~ — **HECHA (2026-08-25), reabierta con caso nuevo.** El
  rechazo aplicaba a "una capa genérica para un usuario hipotético"; lo construido es el seam
  `Store` con dos adapters, y los beneficiarios son los tests, el clone sin env y probar la app
  sin cuenta. Los tres ADRs siguen en pie — el detalle está en ADR 0011 y en el bloque "Resuelto".

**Tier 4 — ~~requiere decisión de arquitectura nueva~~ → la decisión se tomó (2026-07-30, ADR 0010).
El backend existe y la AI ya está en producción. Esto bajó de tier.**
- ~~Auto-generar flashcards~~ — **hecho**, sin sidebar: un botón en la pantalla Curso.
- Sidebar AI — lo único que lo frena hoy es "chrome mínimo" (`ui-principles.md` #3) + falta de caso
  de uso. Ya no es un problema de infra.
- Notas: tonos preestablecidos + custom vía AI — **el candidato más barato del batch AI ahora**:
  reusa la Edge Function, vive en Nota (pantalla ya aprobada), no agrega chrome si son 2-3 botones.
  Falta spec, no falta arquitectura.

## Preguntas abiertas (resolver antes de armar spec.md + issues)

1. ~~**¿Hay presupuesto real para llamadas a LLM**, y la key vive en una Edge Function?~~ —
   **RESUELTA (2026-07-30): sí a las dos.** Las flashcards se generan con Claude desde
   `supabase/functions/generate-flashcards`, key server-side. ADR 0006 reabierto y re-decidido (sigue
   sin ORM). Detalle en `docs/adr/0010-flashcards-como-notas-y-edge-function.md`. Lo que queda abierto
   es más chico: cuánto gasto tolera una feature que dispare llamadas **sin** click explícito.
2. ~~**Seguimiento de hábitos vs `goals` descartado**~~ — **RESUELTA (2026-08-20): sí, hay caso
   concreto distinto.** `goals` eran metas de estudio derivables de `read_log`, miradas 1×/semana;
   hábitos es una entidad con log propio, tocada a diario, e incluye hábitos malos. Ver
   `.scratch/habits/spec.md` y `docs/adr/0009-habit-log-por-dia-y-target-congelado.md`.
3. ~~**DB abstraction a `localStorage`** — ¿para quién?~~ — **RESUELTA (2026-08-25): los tests, el
   clone sin env, y probar la app sin registrarse.** Los tres son concretos y existen hoy. Ver el
   bloque "Resuelto" más abajo y ADR 0011.
4. ~~**Settings** — ¿qué contenido va ahí?~~ — **RESUELTA (2026-08-25): el modo de almacenamiento.**
   Ese fue el primer ajuste con necesidad real de un hogar; el tema se mudó ahí de acompañante.
5. **¿El loop diario (Repaso/Cursos/Nota) ya está en uso diario real?** Misma pregunta sin resolver
   de [[to-grill-retention-system]] — condiciona si Tier 2/3/4 de este doc también son prematuros.

## Resuelto 2026-08-25 — abstracción DB + Settings

**Abstracción DB → `localStorage`: HECHA**, y el grill de arriba que la mandaba a Tier 3 estaba
**bien razonado pero calibrado sobre otra propuesta**. Lo que se rechazó era "una capa genérica
para un usuario hipotético". Lo que se construyó es el seam **`Store`** con dos adapters
(`docs/adr/0011-store-adapter-supabase-o-localstorage.md`), y lo justifican tres beneficiarios
que sí existen hoy:

1. **La suite de tests.** Seis archivos hand-rolleaban un `thenable` falso imitando el builder de
   `supabase-js`; `courses.test.tsx` llegaba a reimplementar la RPC `courses_page` entera en JS.
   Todo eso se borró. La suite pasó de 135 a 160 tests: los 25 nuevos cubren lógica que antes
   **sólo se podía testear con Postgres arriba**.
2. **`git clone && pnpm dev` sin env de Supabase.** Antes tiraba en tiempo de import
   (`createClient` exige url y key) — la app no arrancaba ni para mirarla.
3. **Probar la app sin registrarse.** Que es exactamente lo que la pregunta abierta #3 pedía
   nombrar como caso concreto en vez de "abstracción genérica de storage". Ese es su nombre.

Los tres ADRs que se citaban en contra **siguen en pie**: el modo local es **excluyente** (o
Postgres o navegador, nunca los dos), así que no es el offline-first/sync que cierra ADR 0004;
`Store` no genera SQL ni mapea entidades, así que no es el ORM que rechaza ADR 0006; y Supabase
sigue siendo el default y el único backend que sincroniza entre dispositivos (ADR 0001).

**Settings: HECHO**, y la pregunta #4 ("¿qué contenido lo justifica?") **se respondió sola**: el
modo de almacenamiento necesitaba un hogar. Es un `Drialog`, no una pantalla — no reabre "solo 3
pantallas" de `ui-principles.md`. Contiene lo que hay hoy (tema + modo de almacenamiento) y nada
especulativo. Se abre con `⌘,`, desde ⌘K o desde el menú de cuenta.

**Themes bajó de costo sin haberse tocado:** el hogar que le faltaba (un Settings dialog) ahora
existe. Sigue sin spec y sigue gateado, pero cuando se retome no hay que decidir dónde vive.

**Lo que NO se hizo en este batch:** mobile para Repaso (sigue siendo lo más respaldado del doc,
ADR 0004) y el inventario de acciones sin tecla para "más shortcuts" — sólo se agregó `⌘,`.

## Próximo paso

Tier 1 (shortcuts, mobile) no depende de ninguna respuesta pendiente — **es lo que queda listo para
spec-ear**, y mobile-en-Repaso sigue siendo lo más respaldado del doc (ADR 0004). Las preguntas 3, 4
y 5 (abstracción DB, contenido de Settings, gate del loop diario) siguen abiertas y siguen bloqueando
sus features.
