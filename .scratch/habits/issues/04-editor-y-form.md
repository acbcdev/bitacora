# 04 — Panel del hábito (`Dropover`) + Dialog de hábitos

**Status:** resuelto — implementado 2026-08-20
**Spec:** `.scratch/habits/spec.md`
**Blocked by:** 02

Dos superficies, no tres. El Tooltip de 14 días y el dialog "editor de hoy" del spec anterior se
fusionaron en **un solo `Dropover`**; el alta/edición se fusionó con la vista completa en **un
Dialog**.

## Panel del hábito — `src/habits/habit-panel.tsx`

Lo abre el `⌄` de cada tile (issue 03). Usa **`Dropover`** (`src/core/ui/dropover.tsx`, ya existe
con test): **Popover en desktop, Drawer desde abajo en mobile**.

**Por qué no un Tooltip** (que es lo que decía el spec viejo): un Tooltip de Radix se cierra en
pointer-down y su contenido no es focusable, así que no se puede clickear un cuadrado adentro. Y en
mobile no hay hover — los 14 días quedarían inalcanzables desde el celular, que es donde ADR 0004
dice textual que se repasa.

```
┌────────────────────────────────────┐
│ Gym · 3/semana · lun mié vie       │
│ ■ ■ □ ■ ■ □ ■ ■ □ ■ ■ ■ □ ▣        │
│                                    │
│ sáb 15 ago        −  [ 1 ]  +      │
│ 0  1  2  3  5           [Guardar]  │
└────────────────────────────────────┘
```

- **Cabecera**: nombre, meta en texto (`1/día`, `150 min/semana`, `máx 0/día` — el `máx` es lo que
  distingue piso de techo) y los `days` del hábito si tiene.
- **14 cuadrados** desde `days` de `deriveHabit` (issue 02). **Click en un cuadrado cambia el día
  que estás editando**; el título de abajo dice cuál (`sáb 15 ago`, hoy por defecto).
- **Stepper `− N +`** con el número en el medio (paso 1; 5 en `time`) + input para escribirlo.
- **Presets**: `0 / 10 / 25 / 45 / 60 min` en `time`, `0 / 1 / 2 / 3 / 5` en `count`. El `0` está
  primero a propósito: "no lo hice" es la corrección más común.
- `Guardar` → `useSetDay({ habit, day, value })` (issue 02) — un upsert. `Esc` no toca nada.
- **Existe en las 3 métricas**, también en `check`: el toggle del tile resuelve hoy, pero marcar el
  sábado que te olvidaste pasa por acá.
- Un día pasado **sin fila** se guarda con el `target` actual del hábito. Dejarlo comentado: es una
  aproximación consciente, no un descuido.

**Intensidad de cada cuadrado — sale de la fracción hecha, no de un sí/no.** Meta 25 min y 10
hechos = verde flojo:

```ts
// ponytail: mezclar contra --muted (no transparent) hace que la escala se dé vuelta sola entre
// tema claro y oscuro, sin una paleta por tema.
const perDay = period === "day" ? cell.target : period === "week" ? cell.target / 7 : cell.target / 30
const ratio = Math.min(1, cell.amount / Math.max(perDay, 1))
`color-mix(in oklab, var(--brand) ${Math.round(25 + ratio * 75)}%, var(--muted))`
```

El `target` sale de **la celda** (el congelado de esa fila), no de `habits.target`: un día viejo se
pinta contra la meta que regía entonces. Piso de 25%: "hice algo" nunca se ve igual que "no hice
nada"; el día en cero usa `bg-muted`, el paso más apagado. `bad`: invertido — la recaída en
`destructive`, el día limpio en `brand/40`.

## Vista completa — `src/habits/habits-dialog.tsx`

Dialog de shadcn, mismo shape que `src/courses/course-form.tsx` (submit nativo con `Enter`, `Esc`
cierra, focus management gratis de Radix). Se abre desde un `⚙`/`+` al final de la tira y desde el
**"ver todos"** del overflow (issue 03).

Dialog y no ruta: overlay no reabre "solo 3 pantallas" (`ui-principles.md:52`), mismo criterio que
el Settings dialog de `CONTEXT.md:102-106`.

```
┌─ Hábitos ──────────────────────────────┐
│ 🏋 Gym     3/semana   lun mié vie  🔥3 │
│ 📖 Leer    25 min/día              🔥7 │
│ 🍬 Azúcar  máx 0/día               🔥6 │
│                             [+ Nuevo]  │
└────────────────────────────────────────┘
```

- Lista **todos** los hábitos (los que entran en la tira y los que no) con icono, nombre, meta,
  período, **`days`** y racha. **Este es el único lugar donde `days` se muestra.**
- Alta/edición en el mismo dialog. Campos: `name` (requerido) · `icon` (reusar `IconPicker` de
  `src/courses/icon-picker.tsx`, ya toma `icon: string | null`) · `kind` (bueno / malo) · `metric`
  (check / cantidad / tiempo) · `target` (number, `min=0`) · `period` (día / semana / mes) ·
  `days` (toggle de 7, opcional).
- El form tiene que decir **qué significa el target según el kind** —piso en `good`, techo en
  `bad`— y según la métrica: con `check` el target se fija en 1 y no se pide, con `time` el label
  dice **minutos**, con `count` son veces.
- **`days` tiene que decir que es sólo recordatorio.** Un texto corto tipo *"no afecta la meta: si
  lo hacés otro día cuenta igual"*. Sin eso el usuario asume que marcar lun/mié/vie cambia la racha,
  que es exactamente lo que ADR 0009 decidió que no pase.
- Archivar = `useArchiveHabit()` → set `deleted_at`. **Nunca `DELETE`** (`CONTEXT.md:56`): el
  `habit_log` queda intacto. Confirmación reusando `ConfirmDelete` de `core/components/`.
- Editar `target`/`period`/`metric` **no toca el log**. Las rachas viejas quedan intactas porque
  cada fila lleva su `target` congelado (ADR 0009); sólo el período actual se re-puntúa. Caso a
  mirar una vez: pasar de `count` a `time` reinterpreta los `amount: 1` viejos como 1 minuto.
  Aceptable en el MVP; la salida es archivar y crear uno nuevo, no migrar filas.

## Done cuando

Se puede crear, editar y archivar un hábito sin recargar; el tile refleja el cambio; y desde el
panel se corrige tanto hoy como un día de la ventana de 14. Sin test propio del CRUD: mismo patrón
ya cubierto por `course-form.test.tsx`.

## Comments

- `src/habits/habit-panel.tsx` (Dropover) y `src/habits/habits-dialog.tsx` (lista + form + archivar).
- El dialog es una sola superficie con tres estados: lista, alta y edición.
- Los presets de un `check` son `0 / 1`: el resto de la escala no significa nada ahí.
- Post-review: el `⌄` se esconde al hover **sólo de `md` para arriba**. En Tailwind v4 `hover:`
  vive adentro de `@media (hover: hover)`, así que `opacity-0 group-hover:opacity-100` dejaba el
  trigger invisible en el celular — que es justo el caso que este issue dice que no puede pasar.
- Post-review: `ConfirmDelete` tomó un prop `verb` (default `"Borrar"`). Archivar decía "Borrar"
  en el diálogo y "Archivar" en el botón.
