# 01 — `.icon-btn` muere, `Button` manda

Status: resolved
Blocked by: ninguno — se puede arrancar ya

## Qué

`.icon-btn` es una clase de `index.css` que replica lo que `Button` ya hace con
`variant="ghost" size="icon-sm"`. Hay 14 usos repartidos en sidebar, curso, cursos y nota.

Prefactor: dejar **una sola** forma de escribir un botón de icono antes de que el resto de los
tickets toquen esos mismos nodos.

## Aceptación

- [x] `.icon-btn` no existe ni en `index.css` ni en ningún `className`.
- [x] Los 14 botones de icono son `Button`; los que navegan (los `NavLink` del sidebar) usan `asChild`.
- [x] Cada botón conserva su `aria-label` y su `title` tal como están hoy.
- [x] El delta de tamaño (`.icon-btn` es 30px, `size="icon-sm"` es 28px) se resuelve en `button.tsx`, nunca con clases sueltas en el call site.
- [x] Los botones de borrar siguen poniéndose `destructive` al hover.
- [x] Los `NavLink` del rail colapsado siguen marcando la ruta activa vía `aria-current="page"`.

## Comments

Resuelto. Tres cosas que `.icon-btn` hacía y `Button` no, todas arregladas en `button.tsx`:

- **30px + `rounded-lg`**: `size="icon-sm"` pasó de `size-7 rounded-[min(var(--radius-md),12px)]`
  (28px / 6.4px) a `size-[30px] rounded-lg` (30px / 8px). No había ningún otro uso de `icon-*` en el
  repo, así que no rompe nada más.
- **Gris en reposo**: `compoundVariants` `ghost` + cualquier `icon-*` → `text-muted-foreground`. No
  se tocó la variante `ghost` a secas, así que los botones ghost de texto (Focus, Cancelar, etc.)
  siguen igual.
- **`cursor-pointer`**: va en la base de la cva. Tailwind v4 le pone `cursor: default` a `<button>`;
  `.icon-btn`, `.nav-item` y `.row-link` ya lo forzaban. Efecto lateral consciente: los botones de
  texto también ganan el cursor de mano, que es lo que la app quería en todos lados.

Los iconos con tamaño explícito (`<Trash2 size={14} />`) pasaron a `className="size-3.5"` /
`size-[15px]`: la regla `[&_svg:not([class*='size-'])]:size-4` de `Button` gana sobre el atributo
`width`/`height` del SVG y los hubiera subido a 16px.

El switcher tabla/tarjetas de Cursos perdió `border-0` (la base de `Button` ya es
`border-transparent`) y conserva `rounded-none` + los `aria-pressed:`; el ticket `09` lo reemplaza
por `ToggleGroup`.
