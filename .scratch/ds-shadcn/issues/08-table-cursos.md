# 08 — Tabla de cursos sobre `Table`

Status: resolved
Blocked by: 02, 04

## Qué

La vista tabla de Cursos es un `<table>` crudo con las mismas clases repetidas celda por celda y los
headers generados desde un array de strings.

**Por qué lo bloquean `02` y `04`:** las barras de progreso viven en un `<td>` y el estado
vacío/skeleton viven en el `<tbody>`. Los tres tickets tocan las mismas filas.

## Aceptación

- [x] Usa `Table` y sus subcomponentes; los `className` repetidos por `<th>` / `<td>` se van.
- [x] La fila entera sigue navegando al curso, y las acciones de fila siguen frenando la propagación del click.
- [x] La tabla scrollea horizontalmente en pantallas chicas sin que el layout de la página scrollee.
- [x] Los headers alineados a la derecha (Notas, Inicio, Últ. repaso) conservan su alineación.
- [x] Estado vacío (`03`) y skeleton (`04`) siguen funcionando dentro del `<tbody>`.

## Comments

Resuelto. `pnpm exec shadcn add table`, sin tocar el componente.

`<table>` → `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell`. El
`border-b` por fila, el `border-collapse` y el `w-full` los pone el componente. Los headers salen de
`HEADERS`, una constante a nivel de módulo en vez de un array inline.

Lo que sí quedó en el call site es el padding (`px-3 py-3`), la alineación a derecha de las últimas
tres columnas (`i >= 4`), los anchos fijos (`w-7`, `w-[180px]`) y las clases tipográficas
(`eyebrow`, `mono`, `mono-dim`). Nada de eso es repetición del DS: son decisiones de esta tabla.

`Table` ya viene envuelto en un `div` con `overflow-x-auto`, así que el scroll horizontal en
pantallas chicas queda contenido y la página no scrollea de costado. Por eso también se pudo borrar
`text-sm` de la celda de nombre: `Table` lo pone en la tabla entera.

Fila entera navegable: el `onClick` pasó a `TableRow` con `cursor-pointer`. `.row-link` de
`index.css` quedó sin usos y se borró — `TableRow` ya trae `hover:bg-muted/50` y la transición. El
hover pasa de `bg-muted` a `bg-muted/50`, que es el default del DS.

Las filas de header y de vacío llevan `hover:bg-transparent`: no son navegables y no tienen por qué
iluminarse.

El `Empty` del `03` sigue adentro de un `TableCell colSpan={HEADERS.length}` (antes era un `8`
suelto) y el skeleton del `04` sigue reemplazando la tabla entera, no el `tbody`.
