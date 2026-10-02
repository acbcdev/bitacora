# Duplicación interna: popovers color/highlight en bubble-menu

**Status:** resolved

## Problema

`src/core/components/bubble-menu.tsx` (~340-395): los dos bloques `<Popover>` de color y highlight
son casi idénticos — difieren sólo en `kind` ("color"/"highlight"), el accessor del estado activo
(`active.color`/`active.highlight`), el padding del trigger y los comandos unset. Los subcomponentes
(`PaletteGrid`, `ClearButton`) ya están extraídos; la envoltura quedó duplicada (~30 líneas × 2).

## Fix

Un componente `ColorPopover({ kind, active, open, onOpenChange, onPick, onClear, children })` que
tome el botón trigger como children; los dos call sites quedan de ~6 líneas.

## Criterio

- Mecánico, sin tocar `pick()` ni `shouldShow`.
- Tests de bubble-menu (234 líneas) en verde — los `data-testid="palette-{kind}-{i}"` y
  `"clear-{kind}"` no cambian.

## Answer

`ColorPopover` extraído (toma `kind`, `active`, `open`, `onOpenChange`, `onPick`, `onClear`, el ref
`popoverOpen` y el trigger como children). Los dos call sites quedaron a un bloque de ~12 líneas.
`data-testid` intactos; suite en verde.
