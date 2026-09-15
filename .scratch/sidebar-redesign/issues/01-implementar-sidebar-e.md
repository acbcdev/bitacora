# Implementar sidebar de cuaderno (variante E)

Status: done

Plegar la variante E ("UI Bitácora") del prototipo en el componente real del sidebar
de cuaderno (`src/notebooks/notebook.tsx` + relacionado). La estructura completa y las
decisiones validadas están en el `spec.md` del feature (`.scratch/sidebar-redesign/spec.md`).

Alcance:

- Reemplazar el listado de notas actual del sidebar por la estructura de la variante E:
  header compacto (icono + crumb + título), chips de estado, búsqueda con `/`,
  filas compactas con frescura por nota, dropdown `⋯` con las acciones de
  `note-actions.tsx`, footer con `＋ Nueva nota · N`.
- Estilo con los tokens reales del DS (`src/index.css`): sidebar `#1c1c1c`, card
  `#232323`, brand verde, radio 8/12. Nada de rosa (ese color es solo del icono del
  cuaderno).
- La frescura sale de `last_reviewed_at` de la nota (verificar qué expone `Store` /
  `src/core/store/derive.ts`; si no existe, derivarlo ahí — las pantallas no piden tablas).
- Notas nunca repasadas: celda de frescura vacía, no "sin leer".
- El repaso no se ejecuta desde el sidebar (vive en Home/Repaso).
- Cuidar el detalle del temblor: celda derecha con ancho/alto fijos, `.r` y dropdown
  en la misma celda de grid (ver spec).
- shadcn/Radix para el dropdown (`DropdownMenu` de shadcn) — no reinventar a mano.

Referencia visual: prototipo en rama `prototype/sidebar-redesign` —
`.scratch/sidebar-redesign/prototype.html`, variante E (`?variant=e`).

Fuera de scope: variantes F (Papel y tinta) y G (Terminal) — ideas reservadas en el
spec, no implementar.

## Comments

- Implementada (2025-…): variante E plegada en `src/notebooks/notebook.tsx`. Frescura derivada de `readStats().byNote.last` (snapshot) con `daysSince()` en `core/lib/day.ts`; menú por nota reusa `NoteActions` (ahora acepta `content` async y `hideNotebook`). Se quitaron retención y barra de progreso (CONTEXT.md actualizado). Tests: `notebook.test.tsx` + `core/lib/day.test.ts`.
