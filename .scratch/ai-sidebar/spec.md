# Sidebar de integración AI

**Status:** bloqueado — no por infra, por chrome: `ui-principles.md` #3 ("sin sidebars pesadas") + falta de caso de uso que justifique la superficie. Nunca dependió del gate de uso real (levantado 2026-09-23) ni de arquitectura (resuelta 2026-07-30, ADR 0010).

Idea original (brain dump): extraer/crear información de los datos. Ej: "créame flashcards de este curso" o que se generen automático.

## Lo que ya cayó (2026-07-30, ADR 0010)

- ~~Depende de la entidad `flashcards`~~ — son `notes.kind = 'flashcard'`, ya se generan con AI (botón "Generar flashcards" en la pantalla Curso).
- ~~Costo "$0"~~ — el $0 literal se rompió a sabiendas (ADR 0010). Sigue valiendo el criterio, no el número: el gasto de hoy es un click explícito por curso; un sidebar AI que dispare llamadas **sin** click explícito hay que presupuestarlo aparte.
- ~~API key necesita backend nuevo~~ — `supabase/functions/generate-flashcards` corre con key server-side + JWT del usuario (RLS intacta). ADR 0006 re-decidido: sigue sin ORM. Una feature AI nueva ya no es decisión de arquitectura, es una función más.

## El blocker que queda

`ui-principles.md` #3: "Sin sidebars pesadas, sin toolbars llenas de botones que no se usan." Un sidebar de AI es chrome adicional. Se resuelve con un caso de uso concreto que justifique la superficie, no con infra.

## Relacionado

- [[to-grill-retention-system]] — el ítem "AI genera flashcards" ya salió de ahí.
- ADR 0010 (`docs/adr/0010-flashcards-como-notas-y-edge-function.md`).
