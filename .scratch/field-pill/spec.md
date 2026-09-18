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

## Decisión

Componente custom `FieldPill` (`src/notebooks/field-pill.tsx`) sin portal ni dependencias
de popover: pill con `<input>` libre + dropdown propio (`absolute` dentro del modal, no
portaleado). Filter case-insensitive, valor libre creable, dot de color por valor,
truncado con `min-w-0` en toda la cadena, scroll con `max-h` estático.

## Pendiente (resolver después)

- Ver issues/.
