# ADR 0014 — Course → Notebook (generalización del contenedor, renombre completo)

**Status:** Accepted

## Contexto

El dominio estaba course-céntrico: la entidad `Course` solo describía cursos, pero el uso real
incluye tomar notas de **lecturas de libros** y **escritura propia**. La capacidad ya existía
(un libro puede ser una fila de `courses` con sus notas y ya repasan), pero el vocabulario
mentía: "curso" excluye lo demás y hace que el modelo no tenga sentido.

Grilling de 2026-08-xx (`.scratch/notebook-rename/`), vía `/grill-with-docs`. Decisiones de la
sesión:

- **Libro = contenedor.** Un libro es un contenedor con notas (resumen por sesión de lectura).
  Se descartaron notas sueltas y un diario único de lectura.
- **Todo repasa igual.** Notas de libros y de escritura entran en la Cola de repaso como
  cualquier nota. No hay distinción de comportamiento.
- **No hay campo `kind`.** Se lo planteó y se descartó en la misma sesión: entre notas de libros
  y de cursos "no cambia mucho" — `kind` sería una etiqueta sin efecto, duplicado de `area`
  (texto libre, ya existe). La diferencia curso/libro/escrito vive en `area` ('Libros', etc.).
- **"Blocks" descartado:** colisiona con los bloques del documento Tiptap (dos conceptos, mismo
  nombre). Término elegido: **Notebook**.

## Decisión

**Renombre completo, ejecutado de una vez** — entidad, schema, código, UI y glosario:

- `courses` → `notebooks` · `notes.course_id` → `notebook_id` (`references notebooks(id) on
delete set null`). `ALTER TABLE ... RENAME` preserva las filas: los 59 contenedores reales y
  sus notas migradas de Notion sobreviven sin transformación.
- Regenerar tipos de `supabase-js`, tocar la RPC `review_queue()`, las políticas RLS que
  referencian el nombre de tabla, y el bucket `course-icons` queda como está (URLs guardadas no
  cambian).
- Código (`src/cursos/` → `src/notebooks/` o el nombre que ya tenga el módulo), `Store`
  (`uploadCourseIcon` → `uploadNotebookIcon`), `derive.ts`, tests, y UI: sidebar "Notebooks".
- Glosario: **Course** se reemplaza por **Notebook**; **Note** queda igual.

No cambia nada de comportamiento: la Cola de repaso sigue igual (intercalado por
`notebook_id`, notas sin contenedor fuera), progreso y retención siguen derivados por
contenedor.

## Consecuencias

- El modelo describe el uso real: notebooks de curso, de libro, de escritura.
- Dif grande pero mecánico — el costo es de una vez; dejar DB y código desalineados lo haría
  peor (el seam exige coherencia de nombres, ADR 0011).
- `source` ("dónde se estudió") sigue siendo del notebook: para un libro puede quedar null o
  ser la editorial — texto libre, sin enum, sin reglas nuevas.
