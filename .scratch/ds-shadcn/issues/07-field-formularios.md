# 07 — `Field` en los formularios

Status: ready-for-agent
Blocked by: 06

## Qué

El formulario de curso (nombre, estado, inicio, fin) y el login (email) arman sus campos con un
`const field = "flex flex-col gap-1.5"` y un `<span className="eyebrow">` haciendo de label. El
`eyebrow` es un estilo tipográfico, no una etiqueta: los labels no quedan asociados a su control.

**Por qué lo bloquea `06`:** el select de estado y su `<label>` son el mismo nodo JSX que reescribe
el ticket anterior.

## Aceptación

- [ ] Los 5 campos usan `Field` / `FieldLabel`; la constante `field` desaparece.
- [ ] Cada label queda asociado a su control — click en el label enfoca el campo.
- [ ] El error del login se muestra con `FieldError` y `aria-invalid`, no con un `<p>` suelto abajo.
- [ ] "Nombre" sigue siendo `required` y con `autoFocus` al abrir el formulario.
- [ ] Los campos de fecha siguen siendo `<input type="date">` nativo.
- [ ] `login.test.tsx` sigue verde.
