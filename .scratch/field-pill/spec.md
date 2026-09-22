# FieldPill — selector custom de Fuente/Área en el form de notebooks

## Contexto

El pill de Fuente/Área estaba construido sobre `Combobox` de `@base-ui/react` (`PillCombobox`
en `notebook-form.tsx`). No satisface las funciones que queremos y acumuló parches frágiles:

- El dropdown no scrolleaba dentro del modal (la CSS var `--available-height` de Base UI
  no se seteaba en el popup portaleado al dialog; quedó parchado con un fallback).
- El Radix Dialog modal pone `pointer-events: none` en body y el popup portaleado a body
  necesitó un parche propio (`pointer-events-auto` en el popup).
- Para abrir el combo en tests hubo que disparar la secuencia completa
  pointerdown+mousedown+click+focus de Base UI.
- El ancho del popup dependía de `--anchor-width` (otra var runtime).

## Decisión (implementada)

Componente custom `FieldPill` (`src/notebooks/field-pill.tsx`) sin portal ni dependencias
de popover: pill con `<input>` libre + dropdown propio (`absolute` dentro del modal, no
portaleado). Filter case-insensitive, valor libre creable, dot de color por valor,
truncado con `min-w-0` en toda la cadena, scroll con `max-h` estático.

---

## Sesión de grilling — decisiones 1 a 12 (PENDIENTE implementar)

Verificada contra el código actual: los 5 ítems del issue 01 ya están implementados
(teclado, scroll con `max-h-72`, truncado, valor libre, "Sin resultados"). Las decisiones
siguientes salen de la sesión de grilling del 2026-02 y **aún no están en el código**.

### Comportamiento

1. **Escape: dropdown primero.** Si la lista está abierta, Escape la cierra con
   `stopPropagation` (el modal queda). Si está cerrada, el Escape sigue y cierra el Drialog.
2. **ARIA: `aria-activedescendant`.** Combobox editable: el foco nunca sale del input.
   `id={\`${id}-option-${i}\`}`en las opciones +`aria-activedescendant` en el input; el
   screen reader anuncia el ítem destacado. (Se descartó roving tabindex: rompe el typing
   en un combobox con input libre.)
3. **Chevron decorativo.** Se elimina el `<button tabIndex={-1}>` duplicado; queda
   `<ChevronDown aria-hidden />`. El gesto de abrir es el click/focus del input.
4. **Dot = identidad del valor.** El dot aparece siempre que hay valor (pill, dropdown,
   footer, mismo color = `dotColor(value)`). Se elimina la prop `showDot` y su lógica de
   "par fuente+área completo" del form.
5. **Enter sin match = submit del form.** Tipear un valor nuevo + Enter submittea: el valor
   queda como fuente/área nueva (texto libre, manda el schema). Documentar y testear.
6. **Scroll con el highlight.** Al mover el highlight con ↓/↑, la opción destacada hace
   `scrollIntoView({ block: "nearest" })` (directo en el handler, sin efecto ni rAF).
7. **Fix stacking.** El dropdown pinta debajo de los botones del footer (bug de stacking:
   el footer es hermano posterior con background y gana el orden de pintado pese al `z-50`
   del popup). Elevar el stacking context de la raíz del pill cuando está abierto
   (`z-10`-algo en el root con `open`) para que el dropdown cubra todo el modal.

### Look Notion

1. **Chip sólido + ×.** Valor seleccionado = chip con fondo sólido del color del dot y ×
   a la derecha para vaciar. Sin valor → placeholder + icono como hoy. Un solo chip a la
   vez: elegir otra opción o crear desde cero **reemplaza** el valor (el `onChange` ya
   funciona así).
2. **Dropdown a lo Notion.** Opciones como chips coloreadas (fondo sólido del color del
   dot), la destacada con ring; encabezado "Selecciona o crea una opción" solo cuando no
   hay filtro. Con el chip puesto, escribir arranca una búsqueda nueva y Enter sin match
   crea desde cero (reemplaza el chip).
3. **× del chip:** vacía el valor, el input queda con placeholder y el dropdown abierto
   para elegir/crear otro.

### Estructura y docs

1.  **Ubicación: `core/ui/`.** Mover `field-pill.tsx` de `src/notebooks/` a `src/core/ui/`
    como input genérico, aunque hoy tenga un solo consumidor (`notebook-form.tsx`).
2.  **Docs.** ADR 0016 "FieldPill custom en vez de Combobox de Base UI" (portal, vars
    runtime, pointer-events, secuencia de apertura en tests como porqué) + corregir en
    `CONTEXT.md` el párrafo de `source`/`area`: `<datalist>` → FieldPill (se calcula en
    cliente desde `useNotebooks()`, sin CRUD de categorías).

### Tests (`src/core/ui/field-pill.test.tsx`, Vitest + Testing Library)

- ↓/↑ mueven el highlight, Enter selecciona, Escape cierra el dropdown **sin cerrar el
  modal** (assert: el dialog sigue montado).
- Filtro case-insensitive; "Sin resultados" cuando no matchea.
- Enter sin match submittea el form (valor tipeado queda).
- Elegir opción reemplaza el valor; × del chip lo vacía.
- `scrollIntoView` llamado al destacar (mock, `block: "nearest"`).

### Fuera de alcance (sin cambios)

- Multi-select de valores, CRUD de categorías, sync de sugerencias: no. Sigue el cálculo
  en cliente desde `useNotebooks()`.
