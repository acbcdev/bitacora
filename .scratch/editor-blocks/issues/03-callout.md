# Callout (nota / aviso / tip)

Status: ready-for-agent

## Qué

Nodo propio `callout` (contenido bloque) con attr `kind` (`note|warning|tip`). Ícono lucide fijo por tipo:
`Info` / `TriangleAlert` / `Lightbulb` (nunca emoji, `docs/design-system.md`). Fondo gris suave, sin color por tipo (ADR 0023). Slash: `/nota`, `/aviso`, `/tip`.
Click en el ícono rota nota → aviso → tip.

## Aceptación

- 3 tipos se crean desde el slash; click en el ícono cambia el tipo y sobrevive al guardado.
- Export `.md`: `> [!NOTE]` / `> [!WARNING]` / `> [!TIP]` + contenido con `> `.
- Parse al pegar: blockquote cuya primera línea es `[!NOTE|WARNING|TIP]` = Callout; `> ` normal
  sigue siendo cita. Round-trip en tests.

## Comments

**Review 2026-10-18** — errores de la implementación anterior:

- **Violación `docs/design-system.md`** ("Íconos siempre SVG (lucide), nunca glifos"): usaba emoji
  ℹ️/⚠️/💡. Decisión: lucide `Info`/`TriangleAlert`/`Lightbulb` (ya importados en `slash-menu.tsx`).
  Spec, este issue y `CONTEXT.md` actualizados.
- Faltan tests de aceptación: crear los 3 tipos desde el slash, y que `kind` sobreviva guardar/recargar.
- Tipos definidos en 3 lugares (`CALLOUT_KINDS`, regex `NOTE|WARNING|TIP`, `.toUpperCase()` en
  export): una sola lista exportada, la regex se arma desde ahí.
- 3 items del slash casi idénticos (`wrapIn("callout", { kind })` ×3): generarlos desde la lista.
- `ORDER` → `KIND_CYCLE`.
- Ojo: item slash "Nota" choca con **Nota** (entidad del dominio) en la búsqueda del menú; evaluar
  título "Callout nota" manteniendo keyword `/nota`.
