# 08 — Tabla de cursos sobre `Table`

Status: ready-for-agent
Blocked by: 02, 04

## Qué

La vista tabla de Cursos es un `<table>` crudo con las mismas clases repetidas celda por celda y los
headers generados desde un array de strings.

**Por qué lo bloquean `02` y `04`:** las barras de progreso viven en un `<td>` y el estado
vacío/skeleton viven en el `<tbody>`. Los tres tickets tocan las mismas filas.

## Aceptación

- [ ] Usa `Table` y sus subcomponentes; los `className` repetidos por `<th>` / `<td>` se van.
- [ ] La fila entera sigue navegando al curso, y las acciones de fila siguen frenando la propagación del click.
- [ ] La tabla scrollea horizontalmente en pantallas chicas sin que el layout de la página scrollee.
- [ ] Los headers alineados a la derecha (Notas, Inicio, Últ. repaso) conservan su alineación.
- [ ] Estado vacío (`03`) y skeleton (`04`) siguen funcionando dentro del `<tbody>`.
