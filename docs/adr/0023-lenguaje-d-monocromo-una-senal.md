# ADR 0023 — Lenguaje visual D: monocromo + una señal

**Status:** Accepted
**Fecha:** 2026-10-13
**Enmienda:** ADR 0005 — "sin design system formal: no tokens propios" deja de valer para tokens
(siguen fuera Storybook y biblioteca documentada). ADR 0013 §2–3 — el dot sigue proporcional, pero
pierde el color `brand↔destructive` y el "cero = rojo pleno".

## Contexto

`src/index.css` ya era un design system de tokens (mapeado sobre slots shadcn) aunque ADR 0005
dijera lo contrario. El rediseño D (`docs/design-system.md`, prototipo en branch
`prototype/design-system`) cambia el lenguaje: la jerarquía sale de luminancia/sombra, no de color.

## Decisión

- **Una señal.** Verde (`--signal`) = cumplido/vivo; rojo (`--destructive`) = te pasaste / acción
  peligrosa. Solo en texto, ícono, dot o barra fina — **nunca relleno de superficie**.
- `--signal` **reemplaza** la familia `--brand` (no conviven dos verdes). No hay `--bad` ni
  `bad-soft`: un solo rojo, `--destructive` (compat shadcn).
- **Excepción categórica única:** ámbar `--warning` para notebook `paused` (dot + texto), porque
  escanear active/paused/done en 59 notebooks necesita tres valores distinguibles.
- **Dots de hábito:** proporcionales (se mantiene 0013 §2) pero monocromos —
  `color-mix(in oklab, var(--foreground) pct%, var(--track))`, `pct` invertido para `bad`. Cero =
  `--track`. Muere `barColor`.

## Alternativas descartadas

- `--signal` al lado de `--brand`: dos verdes, nadie sabe cuál usar.
- `--bad` aparte de `--destructive`: dos rojos que el ojo no distingue.
- Dots binarios del prototipo: revertía 0013 §2 sin razón de dominio.
- `paused` gris: pausado ≈ hecho al escanear.

## Consecuencias

- Agregar un color nuevo al chrome requiere enmendar este ADR. La Paleta fija (8) del editor
  (`--p-*`) es contenido del usuario, no chrome: queda fuera de esta regla.
- `Badge` pierde las variantes `brand`/`warning`; `--warning-bg`, `--brand-*` se borran.
