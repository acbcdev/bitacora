# 04 — Skeletons en vez de pantalla en blanco

Status: ready-for-agent
Blocked by: 03

## Qué

Cuatro pantallas devuelven `null` mientras cargan (Curso, Cursos, Hoy, Nota). El resultado es un
flash en blanco en cada navegación, incluso cuando TanStack Query resuelve desde caché.

**Por qué lo bloquea `03`:** el `null` de carga y el estado vacío son ramas del mismo ternario, en
los mismos cuatro archivos. Serializarlos o es conflicto seguro.

## Aceptación

- [ ] Las cuatro pantallas muestran `Skeleton` en vez de `null` mientras cargan.
- [ ] El skeleton tiene la forma aproximada del contenido real (filas de tabla, bloque de nota), no un rectángulo genérico.
- [ ] Cargado y sin datos → aparece el estado vacío del ticket `03`, nunca un skeleton infinito.
- [ ] Con datos en caché no aparece skeleton (no se agrega un delay artificial).
