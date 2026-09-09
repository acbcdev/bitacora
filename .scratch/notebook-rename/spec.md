# Notebook — renombre de Course (grilling 2026-08-xx)

Sesión `/grill-with-docs`. Contexto: "la parte de cursos no está bien enfocada, debería ser más
abierto — notas de lecturas de libros o escritura".

## Decisiones (una por rama)

1. **Problema real:** no es la cola de repaso (las notas de lectura ya encajan ahí repasan) —
   es el vocabulario/estructura: "curso" excluye libros y escritura.
2. **Contenedor:** libro = contenedor, como un curso. Cada sesión de lectura escribe una nota
   (resumen) y repasa. Descartado: notas sueltas, diario único de lectura.
3. **Renombre:** completo — no solo etiqueta de UI. Entidad, schema, código, glosario.
4. **Término:** **Notebook** (en inglés). Descartado "blocks" (colisión con los bloques Tiptap),
   "fuente" (colisión con `source`), "grupos" (genérico).
5. **Alcance:** renombre + campo `kind` → el `kind` se **descartó** en la misma sesión: entre
   libros y cursos "no cambia mucho". La diferencia vive en `area` (texto libre).
6. **Escritos propios:** repasan igual que todo. "Todo se repasa, es más un renombre para que
   tenga más sentido."
7. **Migración:** todo ahora, en un solo cambio. `ALTER TABLE courses RENAME TO notebooks`,
   `notes.course_id` → `notebook_id`, regenerar tipos, RPC `review_queue()`, RLS, código, UI.
   Los datos existentes (59 contenedores, ~1.500 notas) se preservan sin transformación.

## Comportamiento

Cero cambios de comportamiento. Cola, progreso, retención, flashcards: idénticos, con nombres
nuevos.

Ver ADR: `docs/adr/0014-notebook-rename-courses.md`.
