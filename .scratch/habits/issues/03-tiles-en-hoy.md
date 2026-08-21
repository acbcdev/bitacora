# 03 — Tira de tiles de hábitos en Hoy + chord `h > 1..9`

**Status:** ready-for-agent
**Spec:** `.scratch/habits/spec.md`
**Prototipo:** `.scratch/habits/habits.prototype.tsx`. Dos rondas cerradas: la tira **no** es un
card de filas (con 5 hábitos costaba más alto que la nota), y la anatomía es **relleno** — le ganó a
anillo, subrayado y segmentos, que esconden el número o se rompen con metas de 150 min y techo `0`.
Tercera ronda (grilling 2026-08-20): el chip de una línea pasó a **tile de dos**, con el icono a la
izquierda.
**Blocked by:** 02

`src/habits/habit-tiles.tsx`, montado en `src/review/review.tsx` **entre el card de repaso y
`<Courses embed />`**. Sin ruta nueva (`ui-principles.md:52`).

## Anatomía del tile (`h-16`, ~200px de ancho)

```
┌────────────────────────────────┐
│  ┌──────┐   Gym                │   ← nombre: text-sm font-medium
│  │  🏋  │   2/3          🔥3  ⌄│   ← fracción: text-xs tabular-nums muted
│  └──────┘                      │
└────────────────────────────────┘
   size-10 rounded-md
```

- **Icono en caja a la izquierda**, alineado al alto del tile. Reusar `CourseIcon`
  (`src/courses/course-icon.tsx`) sumándole un prop **`fallback`**: hoy cae duro en `BookOpen`
  (`course-icon.tsx:113`), que para un hábito no significa nada. Una línea de cambio, no un
  componente nuevo.
- **Nombre arriba, fracción abajo.** El número es secundario a propósito: el progreso lo comunica el
  relleno; la fracción confirma.
- **Relleno de progreso** — un `<span aria-hidden>` absoluto con `width: ${pct}%` detrás del
  contenido, **no** un `background-image`: así el texto nunca cambia de color con el progreso.
  `pct = min(100, total / target * 100)`.
- **El color del relleno se calcula, no se elige**: rojo lo que falta, verde lo hecho.

  ```ts
  const done = Math.round(h.kind === "good" ? pct : 100 - pct)
  const scale = `color-mix(in oklab, var(--brand) ${done}%, var(--destructive))`
  return `color-mix(in oklab, ${scale} 30%, var(--card))` // 30% = cuánto pega contra el fondo
  ```

  Contra `var(--card)` y no `transparent`: mantiene legible el texto y da vuelta la escala sola
  entre tema claro y oscuro (ADR 0005, sin design system formal).
- **`good`** — borde normal; cumplido → borde `brand` y nombre en `brand-fg`.
- **`bad`** — borde **punteado**, `−`, y la escala **invertida** (`100 - pct`): vacío verde, techo
  rojo. Llenarse es perder.
- **Pasado el techo el tile se cierra**: borde **sólido** `destructive`. El relleno ya sale rojo al
  100% de la fórmula (`pct = 100` → `done = 0`), sin caso especial. El punteado es "todavía tenés
  margen"; dejarlo punteado con el tile lleno contradice el dato.
- **Estado por métrica** (object-map, no `switch`): `check` → ✓ / "hoy" · `count` → `2/3` ·
  `time` → `10/25 min` + `▶`. El "máx" de un `bad` no entra adentro del tile.
- **Con techo `0`, sin fracción: el número solo** (`Azúcar 7`, no `7/0`).
- **Ancho estable.** `tabular-nums` en la fracción + `min-width` en el slot del número: con el
  cronómetro corriendo ese número sube cada segundo y la tira es `flex` — sin ancho fijo late
  entera. El `⌄` no se desmonta nunca (desmontarlo encoge el tile justo al arrancar el timer).
- **Racha** — sólo si es `≥ 2`. Un `🔥 0` es ruido.
- **Sin dígito visible del atajo.** `g>1..9` tampoco lo dibuja: monta `CourseHotkey` invisibles
  (`app.tsx:234-236`) y el atajo vive en el cheatsheet. Mismo trato acá.
- **`habits.days` no se dibuja en la tira.** Vive en el Dialog (issue 04).

## Overflow — tope de 2 filas + "ver todos"

`flex-wrap` con **máximo 2 filas visibles** (~130px de alto). Lo que no entra queda detrás de un
botón **"ver todos"** que abre el Dialog de hábitos (issue 04). En mobile entran 1 o 2 tiles por
fila, así que sin este tope 5 hábitos empujan la nota fuera de la pantalla — que es donde ADR 0004
dice que se repasa.

**Orden fijo por `created_at`.** Nada reordena la tira (ni "hoy toca", ni cumplidos al final): si el
orden cambia, `h>2` es otro hábito según el día y el chord se vuelve inusable.

## Acciones

- **Cuerpo del tile = acción rápida, un click**, y cuál es la decide la métrica:
  - `check` → **toggle** de hoy (`value = hoy ? 0 : 1`). Con `aria-pressed`.
  - `count` → `+1` (`value = hoy + 1`).
  - `time` → arranca / pausa el cronómetro (issue 06).
  - Todas pasan por `useSetDay` (issue 02). No hay un camino de escritura por métrica.
- **`⌄`** (`opacity-0 group-hover:opacity-100 focus-visible:opacity-100`) abre el `Dropover` del
  issue 04. **Se renderiza en las 3 métricas**, también en `check`: aunque hoy sea un toggle,
  corregir el sábado pasado necesita el panel.
- Optimismo en la UI (`ui-principles.md:19`): el número y el relleno se mueven sin esperar el
  round-trip.

## Teclado

Chord `h>1`..`h>9`, numerado en el orden de los tiles, dispara la misma acción rápida del cuerpo (en
`time`: arranca/pausa). Calcar `CourseHotkey` (`app.tsx:245-255`): **un componente = un `useHotkeys`
por dígito**, porque la lib comparte el buffer de secuencia entre atajos de la misma llamada y si no
sólo dispara el primero. `sequenceTimeoutMs: 900`, `preventDefault: true`.

Vive en la pantalla Hoy, no global. Nada de letra bare (`ui-principles.md:40-45`). Sumar la fila a
la hoja de atajos (`mod+/`).

## Test — `src/review/review.test.tsx` (Seam 2, extender)

Click en el tile de un `count` hace exactamente 1 **upsert** con `habit_id`, `day` de hoy y
`amount: 1` · un segundo click upsertea `amount: 2` (no inserta una fila nueva) · click en un
`check` ya marcado lo deja en `amount: 0` (no borra) · click en un tile `time` arranca el cronómetro
y **no** escribe todavía · `h>1` dispara el primer tile · los tiles no rompen `Enter`/`J`/`K` del
repaso.
