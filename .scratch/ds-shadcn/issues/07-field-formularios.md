# 07 — `Field` en los formularios

Status: resolved
Blocked by: 06

## Qué

El formulario de curso (nombre, estado, inicio, fin) y el login (email) arman sus campos con un
`const field = "flex flex-col gap-1.5"` y un `<span className="eyebrow">` haciendo de label. El
`eyebrow` es un estilo tipográfico, no una etiqueta: los labels no quedan asociados a su control.

**Por qué lo bloquea `06`:** el select de estado y su `<label>` son el mismo nodo JSX que reescribe
el ticket anterior.

## Aceptación

- [x] Los 5 campos usan `Field` / `FieldLabel`; la constante `field` desaparece.
- [x] Cada label queda asociado a su control — click en el label enfoca el campo.
- [x] El error del login se muestra con `FieldError` y `aria-invalid`, no con un `<p>` suelto abajo.
- [x] "Nombre" sigue siendo `required` y con `autoFocus` al abrir el formulario.
- [x] Los campos de fecha siguen siendo `<input type="date">` nativo.
- [x] `login.test.tsx` sigue verde.

## Comments

Resuelto. `pnpm exec shadcn add field` (arrastró `label` y `separator`, los dos los usa
`field.tsx`). La constante `field` ya no existe.

Los cinco campos son `Field` + `FieldLabel htmlFor` con un `id` explícito en cada control
(`course-name`, `course-status`, `course-started`, `course-finished`, `email`). `FieldLabel` es el
`Label` de radix, así que el click en el label enfoca el control — que era el agujero real, no el
estilo.

Los labels conservan la clase `eyebrow`. El ticket objeta que `eyebrow` **hiciera** de label, no que
un label se vea así; con la asociación arreglada, el estilo puede quedarse y la pantalla no cambia.

Login: el `<p className="text-sm text-destructive">` suelto pasó a `FieldError` (que ya renderiza
`role="alert"` y devuelve `null` sin contenido, así que no hizo falta el `error &&`), y el `Input`
lleva `aria-invalid={!!error}`.

`autoFocus` + `required` en Nombre, `type="date"` nativo en Inicio y Fin: sin cambios.
`login.test.tsx` pasa sin tocarlo — busca por placeholder y por rol de botón, y los dos siguen ahí.
