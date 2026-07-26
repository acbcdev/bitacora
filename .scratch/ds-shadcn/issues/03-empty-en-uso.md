# 03 — `Empty` deja de ser código muerto

Status: resolved
Blocked by: ninguno — se puede arrancar ya

## Qué

`src/components/ui/empty.tsx` está instalado y **no lo importa nadie**. Mientras tanto los tres
estados vacíos de la app están escritos a mano:

- tabla de cursos sin resultados,
- Hoy con la cola vacía o el batch terminado,
- curso sin notas.

O se usa, o se borra. Este ticket la usa.

## Aceptación

- [x] Los tres estados vacíos usan `Empty` y sus subcomponentes.
- [x] Hoy sigue distinguiendo "nada para repasar hoy" de "batch terminado", y sigue mostrando cuántas notas se leyeron hoy.
- [x] El botón "Cargar más" vive dentro de `EmptyContent` y sigue reseteando el índice y disparando el refetch.
- [x] Cursos sigue distinguiendo "sin cursos, creá el primero" de "sin coincidencias, ajustá los filtros".
- [x] El estado vacío de la tabla sigue ocupando el ancho completo de la fila.
- [x] Si algún estado vacío no encaja en `Empty`, se borra `empty.tsx` en vez de dejarla sin usar.

## Comments

Resuelto, los tres encajaron — `empty.tsx` no se borra. No se tocó el componente.

- **Hoy**: `Empty` con `EmptyTitle` (el ternario cola-vacía / batch-terminado sigue igual),
  `EmptyDescription` con el contador de leídas y `EmptyContent` con "Cargar más". El
  `setIndex(0) + refetch()` no cambió.
- **Cursos**: el `<td colSpan={8}>` queda, adentro va el `Empty`. La frase suelta se partió en las
  dos piezas que ya tenía: título ("Sin cursos." / "Sin cursos que coincidan.") y descripción
  ("Creá el primero." / "Ajustá los filtros.").
- **Curso sin notas**: mismo split.

Deltas visuales, todos por la estructura del componente, ninguno intencional:

- Curso sin notas y la fila vacía de Cursos ahora centran el texto — `Empty` es
  `items-center text-center`. Antes estaban alineados a la izquierda.
- El título de un estado vacío es `font-medium` en vez de `text-muted-foreground`; la segunda línea
  queda muted. Antes las dos frases iban en una sola línea muted.
- `Empty` trae `border-dashed` sin ancho de borde, así que no dibuja nada. No hace falta anularlo.

Sin `EmptyMedia` en ninguno: no había iconos antes y el spec dice que esto no es un rediseño.
