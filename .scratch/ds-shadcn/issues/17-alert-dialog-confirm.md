# 17 — `AlertDialog` en vez de `confirm()`

Status: ready-for-agent
Blocked by: 01, 10

## Qué

Borrar curso y borrar nota (tres lugares en total) usan `confirm()` nativo: bloquea el hilo, ignora
el design system y no se puede testear sin stub.

**Por qué lo bloquean `01` y `10`:** los tres `confirm()` cuelgan de botones que esos tickets
reescriben, y uno de ellos se muda adentro del dropdown de acciones.

## Aceptación

- [ ] Los tres `confirm()` se reemplazan por `AlertDialog`.
- [ ] El nombre del curso o de la nota aparece en el texto de confirmación.
- [ ] La acción destructiva usa el estilo `destructive` y **no** es la que recibe el foco inicial.
- [ ] Cancelar no borra nada; Esc equivale a cancelar.
- [ ] Borrar una nota desde la pantalla Curso sigue reseteando la selección.
- [ ] Borrar un curso sigue siendo soft delete (ADR 0002) — este ticket no toca la mutation.
