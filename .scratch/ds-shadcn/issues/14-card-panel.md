# 14 — `Card` para lo que queda de `.panel`

Status: ready-for-agent
Blocked by: 03, 08

## Qué

`.panel` es `rounded-xl border bg-card` y marca cuatro superficies: tarjetas de curso, panel de
repaso de Hoy, contenedor de la tabla de cursos y la caja del login.

**Por qué lo bloquean `03` y `08`:** los estados vacíos y la tabla viven adentro de esos paneles.

## Aceptación

- [ ] Las cuatro superficies usan `Card`; `.panel` sale de `index.css`.
- [ ] Las tarjetas de curso siguen navegando al click y resaltando al hover.
- [ ] El panel de repaso sigue conteniendo tanto el estado vacío como el editor en solo lectura.
- [ ] El `overflow-hidden` que le recorta las esquinas a la tabla se conserva.
- [ ] Si `Card` no aporta nada sobre la clase en algún caso (por ejemplo, un panel sin header ni footer), se deja la clase y se documenta en el ticket cuál y por qué.
