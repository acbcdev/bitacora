# Design system v2 — lenguaje visual "D"

Status: ready-for-human

## Pregunta que se respondió

¿Qué lenguaje visual adopta Bitácora? Se tomó el **concepto** de 6 referencias (Dribbble: apps de
bienestar + dashboards Skymetrics/allocation), no sus layouts. La estructura de la app no cambia.

**Prototipo (fuente primaria):** branch `prototype/design-system`, commit `bb5fcf0` —
`git show prototype/design-system:.scratch/design-system/prototype.html > /tmp/p.html && open "/tmp/p.html?ds=D&bg=1&chip=0"`
(`←/→` variantes, `T` tema, `F` fondo, `C` chips).

## Veredicto

Ganó **D — Mezcla**. Descartadas: A (pastel, demasiado color), B (salvo el header), C (salvo repaso
y el concepto de hábitos), el modo light "dark invertido" (ilegible).

| De dónde | Qué se queda |
|---|---|
| A | Superficies redondeadas **sin borde de color** — la jerarquía sale de luminancia (dark) o sombra (light) |
| B | Header Hoy: números mono, historial en barras finas con altura, verde solo meta cumplida / hoy |
| C | Card de repaso (título light grande, ← circular, "Siguiente" pill); hábitos = bloque que sube sobre hatch |
| feedback | Monocromo + **una** señal: verde = cumplido/vivo, rojo = te pasaste — solo en texto/ícono, nunca relleno |

## Tokens

| Token | Dark (carbón) | Light (hueso) |
|---|---|---|
| bg | `#131315` | `#f3f3f0` |
| sidebar / borde | `#0e0e10` / `#232326` | `#ebebe7` / `#deded9` |
| card | `#1b1b1d` | `#fff` + `0 1px 2px rgb(0 0 0/.05)` |
| hero (card repaso) | `#242427` | `#fff` + `0 1px 2px rgb(0 0 0/.04), 0 12px 32px rgb(0 0 0/.07)` |
| chip / kbd | `#27272a` | `#efefeb` |
| track | `#2d2d31` | `#e4e4df` |
| hatch | `#222225` (2px) | `#f0f0ec` (1.5px) |
| bloque hábito | = hero | `#e9e9e4` |
| ink / ink-2 / muted | `#f2f2f2` / `#c9cacc` / `#8a8c90` | `#111113` / `#2b2c2f` / `#5c5e63` |
| signal (verde) | `#35c26b` | `#15803d` |
| bad → `--destructive` | `#f07a70` | `#c2362b` |
| primary / ink | `#f2f2f2` / `#0b0b0c` | `#111113` / `#fff` |
| estado notebook active·paused·done | `--signal` · `--warning` `#d5a75f` · `--muted-foreground` | `--signal` · `--warning` `#c9962b` · `--muted-foreground` |

Ámbar de `paused` = **única excepción** a "monocromo + una señal": es categórico (escanear 59
notebooks), no señal. Solo en dot y texto, nunca relleno. Sin `drop` (no existe en el schema).

- **Forma:** botones/chips/ítems sidebar pill (999px) · tiles y cards 24px · card de repaso 32px · kbd 6px · barras 2px.
- **Tipo:** UI en Inter Tight · números en JetBrains Mono · título de repaso 44px y número de hábito 40px
  en **300 dark / 400 light** (irradiación: claro sobre oscuro engorda, oscuro sobre claro adelgaza).

## Reglas de componente

- `kbd` dentro de botón sólido: `color-mix(in oklab, currentColor 10%, transparent)` — se adapta solo.
- Íconos siempre SVG (lucide), nunca glifos (`✓` cae en fuente de sistema y se ve como √).
- Hábito: vacío = hatch · progreso = bloque a `pct` · cumplido = bloque lleno + check verde ·
  corriendo = punto verde que pulsa · pausado = bloque tenue + punto fijo · pasado = número rojo, sin relleno.
- Header Hoy: fecha humana ("lunes 13 de octubre"), barras **inline** con etiqueta "14 días" (se
  borra el tooltip del 🔥). Las barras muestran el **Cumplimiento diario** de hábitos (ver
  `CONTEXT.md`), no lecturas: altura = `cumplidos / total` (piso 12% si 0 o sin hábitos), verde
  **solo** si todos cumplidos — hoy incluido; hoy no cumplido = `--ink-2`, nunca verde. 🔥 racha de
  lectura y `n/3` se quedan. (El prototipo pintaba hoy siempre verde: bug, no se copia.)
- No mostrar datos que la app no tiene (la barra "18/25" y el delta "+3" del prototipo eran inventados).

## Decisiones registradas

ADR 0023 (enmienda 0005 en tokens y 0013 §2–3 en color del dot). `CONTEXT.md`: pantalla **Hoy**,
**Cumplimiento diario**.
