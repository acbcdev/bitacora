# Tokens del lenguaje D en index.css

Status: resolved

## Qué

Reemplazar los valores de `:root` y `.dark` en `src/index.css` por la tabla de tokens de
`../spec.md`, mapeados sobre los slots shadcn existentes (`--background`, `--card`, `--muted`, …).
Slots nuevos solo donde no hay equivalente: `--hero`, `--signal`, `--hatch`.
`--signal` **reemplaza** a la familia `--brand` (`brand`, `-strong`, `-soft`, `-fg`, `-foreground`):
se borra, no convive. Los usos de relleno (`bg-brand*`, el `color-mix(var(--brand))` del historial)
se rediseñan a texto/ícono o neutro — "una señal, nunca relleno". Sin `bad-soft` (su único uso en
el prototipo era el delta inventado). Un solo rojo: `bad` **es** `--destructive` re-valuado (compat
shadcn); no hay slot `--bad`. "Te pasaste" = `text-destructive`.
`notebooks/notebook-status.ts`: dots `active`/`paused`/`done` = `bg-signal`/`bg-warning`/
`bg-muted-foreground` (dot = ícono, se permite). Badge sin relleno: se borran las variantes
`brand`/`warning` de `Badge`; estado = texto `text-signal`/`text-warning` sobre chip neutro.
`--warning-bg` se borra.
Font UI: Archivo → Inter Tight (`@fontsource-variable/inter-tight`). Radios según spec.
Decisión ya registrada en ADR 0023 — implementar, no re-decidir.

## Aceptación

- Dark carbón y light hueso con los valores del spec; sin bordes de color en cards.
- `pnpm build` y `pnpm test` verdes.
- Screenshot dark + light del Hoy comparado contra el prototipo (`prototype/design-system`) — **el spec manda** donde difieren (el prototipo tiene datos inventados y bugs ya corregidos en el spec).
