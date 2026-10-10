# Callout (nota / aviso / tip)

Status: needs-triage

## Qué

Nodo contenedor con attr `kind` (`info|warn|tip`). Preferir **blockquote con attr** antes que nodo
nuevo si el esquema lo permite. Slash `/callout`. Sin selector de icono custom.

## Aceptación

- 3 variantes con los tokens de color del tema actual (ver `.scratch/themes`).
- Markdown: degrada a `> ` con prefijo `[!kind]` (sintaxis GitHub).
