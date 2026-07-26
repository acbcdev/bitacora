# 04 — Skeletons en vez de pantalla en blanco

Status: resolved
Blocked by: 03

## Qué

Cuatro pantallas devuelven `null` mientras cargan (Curso, Cursos, Hoy, Nota). El resultado es un
flash en blanco en cada navegación, incluso cuando TanStack Query resuelve desde caché.

**Por qué lo bloquea `03`:** el `null` de carga y el estado vacío son ramas del mismo ternario, en
los mismos cuatro archivos. Serializarlos o es conflicto seguro.

## Aceptación

- [x] Las cuatro pantallas muestran `Skeleton` en vez de `null` mientras cargan.
- [x] El skeleton tiene la forma aproximada del contenido real (filas de tabla, bloque de nota), no un rectángulo genérico.
- [x] Cargado y sin datos → aparece el estado vacío del ticket `03`, nunca un skeleton infinito.
- [x] Con datos en caché no aparece skeleton (no se agrega un delay artificial).

## Comments

Resuelto. `pnpm exec shadcn add skeleton`, sin modificar el componente.

Dos formas alcanzan para las cuatro pantallas, así que viven juntas en
`src/components/skeletons.tsx`:

- `NoteSkeleton` — barra de vuelta + título + tres líneas de cuerpo. La usan Nota, Curso (panel
  izquierdo) y Hoy (dentro del `panel`).
- `TableSkeleton` — seis filas con nombre / estado / barra / contador. La usa Cursos.

Cuatro copias del mismo bloque en cuatro archivos era peor que un archivo con dos componentes.

Sobre las otras dos casillas: `isLoading` de TanStack ya es `false` cuando hay caché, así que el
skeleton no aparece en navegación repetida y no hizo falta ningún delay. Y como `isLoading` pasa a
`false` apenas resuelve, con lista vacía cae directo en el `Empty` del `03` — el skeleton no puede
quedarse pegado.

Sabido y aceptado: si Cursos está en vista tarjetas y recarga, ve el skeleton de tabla. La primera
carga siempre arranca en `view === "tabla"` (el estado no se persiste), así que en la práctica no
pasa. Si `09` o un ticket futuro persiste la vista, este skeleton necesita la rama de tarjetas.
