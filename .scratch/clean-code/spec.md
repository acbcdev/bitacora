# Clean Code

**Status:** abierto 2026-10-01. Goal de calidad, no feature — no bloquea ni bloquea nada de `.scratch/*`.

## Origen

Pedido directo del usuario. Este repo ya pasó una auditoría (`.scratch/project-hygiene/`, 2026-10-01) enfocada en
riesgo/infraestructura (flaky, CI, secretos, e2e). Este goal es la segunda pasada, enfocada en **legibilidad y
simplicidad del código propio** — no repite hallazgos de hygiene, los referencian.

## Qué significa "limpio" en este repo

No es gusto personal. Es la definición de CONTEXT.md + ponytail aplicada a esta base:

- **Comportamiento intacto:** cada cambio debe mantener la suite y el typecheck en verde. Sin excepciones.
- **Tamaño:** módulos que se leen de arriba a abajo. Un archivo de 800 líneas que mezcla tres responsabilidades no es limpio aunque funcione (ver hygiene #04).
- **Vocabulario del dominio:** nombres usan las palabras del CONTEXT.md (`nota`, `repaso`, `snapshot`, `Store`, `sesión de repaso`). Sin sinónimos.
- **Nada especulativo:** sin abstracción con una sola implementación, sin config para valores que no cambian, sin helpers "por si acaso".
- **Derivación en su lugar:** hechos derivados viven en `src/core/store/derive.ts`; pantallas no calculan lo que el `Snapshot` ya sabe (ADR 0003).

## Regla dura (anti-cosmética)

Cada hallazgo nombra **archivo y evidencia concreta** (línea, duplicación real, nombre que miente, responsabilidad
mezclada, código muerto). "Se puede expresar mejor" no es hallazgo. Un finding sin evidencia se cierra `wontfix`.

## Orden de revisión

1. `src/core/store/` (el seam — es el contrato de todo)
2. `src/core/derive.ts` + `src/core/components/` (está aquí el volumen: `block-controls.tsx` 826 líneas, `bubble-menu.tsx` 473)
3. Pantallas: `src/notes/`, `src/review/`, `src/habits/`, `src/notebooks/`, `src/settings/`

## No hacer

- Deps nuevas para "limpiar" algo que 10 líneas propias resuelven.
- Reescribir un módulo grande sin cambio mecánico probado por su suite (regla de hygiene #04: dividir solo si el split es mecánico o algo vuelve a tocar ese archivo).
- Tocar `src/core/ui/` (shadcn generado) ni `supabase/` en esta pasada.
- Refactor "de paso" dentro de un feature nuevo — los hallazgos van a issues de ESTE goal, no se esmurrean en PRs de otra cosa.
