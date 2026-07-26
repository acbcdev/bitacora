# 17 — `AlertDialog` en vez de `confirm()`

Status: resolved
Blocked by: 01, 10

## Qué

Borrar curso y borrar nota (tres lugares en total) usan `confirm()` nativo: bloquea el hilo, ignora
el design system y no se puede testear sin stub.

**Por qué lo bloquean `01` y `10`:** los tres `confirm()` cuelgan de botones que esos tickets
reescriben, y uno de ellos se muda adentro del dropdown de acciones.

## Aceptación

- [x] Los tres `confirm()` se reemplazan por `AlertDialog`.
- [x] El nombre del curso o de la nota aparece en el texto de confirmación.
- [x] La acción destructiva usa el estilo `destructive` y **no** es la que recibe el foco inicial.
- [x] Cancelar no borra nada; Esc equivale a cancelar.
- [x] Borrar una nota desde la pantalla Curso sigue reseteando la selección.
- [x] Borrar un curso sigue siendo soft delete (ADR 0002) — este ticket no toca la mutation.

## Comments

Resuelto. `pnpm exec shadcn add alert-dialog`. Los tres `confirm()` (curso desde el dropdown de
acciones, nota desde la pantalla Curso, nota desde la pantalla Nota) salieron; no queda ningún
`confirm(` en `src/`.

Los tres comparten `src/components/confirm-delete.tsx`, que es **controlado por estado y no por
`AlertDialogTrigger`**: uno de los call sites vive adentro del `DropdownMenu` de acciones de la fila,
y ese dropdown desmonta su contenido al cerrarse — se llevaría el trigger puesto y el diálogo nunca
abriría. Con `open` / `onOpenChange` desde afuera los tres call sites quedan iguales.

El nombre del curso o de la nota va en el título (`¿Borrar "X"?`); las notas sin título muestran
`(sin título)`. `AlertDialogAction` lleva `variant="destructive"`, y el foco inicial lo toma
`AlertDialogCancel` — radix lo hace solo en `AlertDialog`, no hizo falta `autoFocus`. Esc cancela.

Borrar una nota desde la pantalla Curso sigue reseteando la selección (`onSuccess: () =>
setSel(null)`), y la mutation de borrar curso no se tocó: sigue siendo el soft delete del ADR 0002.
