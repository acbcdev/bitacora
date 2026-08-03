# To-grill: plataforma (AI sidebar, shortcuts, hábitos, mobile, settings, themes, DB abstraction, tonos de nota)

**Status:** grilling — sin resolver, sin spec.md todavía.
**Relacionado:** [[to-grill-retention-system]] — el ítem "AI genera flashcards" depende del Tier 2
de ese doc (la entidad `flashcards` todavía no existe).

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

**Sidebar de integración AI (generar flashcards automático) → varios problemas simultáneos:**
- Depende de que exista la entidad `flashcards` — no existe todavía (Tier 2 de
  [[to-grill-retention-system]], sin resolver).
- `ui-principles.md` regla #3: "Sin sidebars pesadas, sin toolbars llenas de botones que no se usan."
  Un sidebar de AI es chrome adicional — choca directo con "chrome mínimo".
- Costo: CONTEXT.md:27, textual: "Costo $0, sin servidores propios." Llamadas a un LLM tienen costo
  por token — rompe el presupuesto $0 explícito del proyecto.
- Seguridad: igual que Turso fue descartado en ADR 0001 porque el token expuesto en el browser =
  compromiso total, una API key de LLM en el cliente tiene el mismo problema. Necesita vivir detrás
  de un backend (Supabase Edge Function). Eso reabre ADR 0006, que dice textual: "Único caso para
  reabrir: si aparece un backend propio (Edge Functions / server)." No está prohibido, pero es una
  decisión de arquitectura nueva, no un feature chico.

**Notas — botones de tono preestablecido + tonos propios (AI rewrite) → mismo problema de costo y
arquitectura que el sidebar AI** (LLM = $, API key necesita backend). Distinto en que no agrega
pantalla nueva (vive en Nota, una de las 3 pantallas ya aprobadas) — menor fricción con
`ui-principles.md` en ese eje. Sí hay que vigilar cuántos botones se agregan al editor: "chrome
mínimo" aplica igual ahí adentro.

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
- Settings — confirmar qué contenido real la justifica como pantalla propia.

**Tier 3 — contradice una decisión ya tomada, no reabrir sin caso nuevo**
- Seguimiento de hábitos — mismo territorio que `goals`, ya descartado a propósito
  (CONTEXT.md:84-88).
- Abstracción DB → localStorage — contradice ADR 0001 + 0004 + 0006 simultáneamente, y es
  generalización sin usuario real que la necesite hoy.

**Tier 4 — requiere decisión de arquitectura nueva (AI = $ + backend nuevo)**
- Sidebar AI (auto-generar flashcards) — bloqueado además por Tier 2 de
  [[to-grill-retention-system]] (flashcards no existen aún). Choca con "chrome mínimo".
- Notas: tonos preestablecidos + custom vía AI — mismo costo/arquitectura, menor fricción con
  "solo 3 pantallas" porque vive en Nota.

## Preguntas abiertas (resolver antes de armar spec.md + issues)

1. **¿Hay presupuesto real para llamadas a LLM** (flashcards auto, tonos de nota)? Rompe el "$0, sin
   servidores propios" de CONTEXT.md. Si sí: ¿la API key vive en una Supabase Edge Function nueva
   (reabre ADR 0006 por el único caso que ese ADR deja abierto)?
2. **Seguimiento de hábitos vs `goals` descartado** — ¿hay un caso concreto distinto al que ya se
   evaluó y se descartó, o es la misma idea con otro nombre?
3. **DB abstraction a `localStorage`** — ¿para quién? Hoy sos el único usuario. Si el motivo real es
   otro (demo sin login, por ejemplo), nombrar ese caso concreto en vez de la abstracción genérica.
4. **Settings** — ¿qué contenido va ahí que no sea ya el toggle de tema del sidebar?
5. **¿El loop diario (Repaso/Cursos/Nota) ya está en uso diario real?** Misma pregunta sin resolver
   de [[to-grill-retention-system]] — condiciona si Tier 2/3/4 de este doc también son prematuros.

## Próximo paso

Resolver las preguntas de arriba antes de tocar `spec.md`. Tier 1 (shortcuts, mobile) no depende de
ninguna respuesta — se puede spec-ear independiente si se quiere avanzar sin esperar.
