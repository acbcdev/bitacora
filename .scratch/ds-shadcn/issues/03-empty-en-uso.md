# 03 — `Empty` deja de ser código muerto

Status: ready-for-agent
Blocked by: ninguno — se puede arrancar ya

## Qué

`src/components/ui/empty.tsx` está instalado y **no lo importa nadie**. Mientras tanto los tres
estados vacíos de la app están escritos a mano:

- tabla de cursos sin resultados,
- Hoy con la cola vacía o el batch terminado,
- curso sin notas.

O se usa, o se borra. Este ticket la usa.

## Aceptación

- [ ] Los tres estados vacíos usan `Empty` y sus subcomponentes.
- [ ] Hoy sigue distinguiendo "nada para repasar hoy" de "batch terminado", y sigue mostrando cuántas notas se leyeron hoy.
- [ ] El botón "Cargar más" vive dentro de `EmptyContent` y sigue reseteando el índice y disparando el refetch.
- [ ] Cursos sigue distinguiendo "sin cursos, creá el primero" de "sin coincidencias, ajustá los filtros".
- [ ] El estado vacío de la tabla sigue ocupando el ancho completo de la fila.
- [ ] Si algún estado vacío no encaja en `Empty`, se borra `empty.tsx` en vez de dejarla sin usar.
