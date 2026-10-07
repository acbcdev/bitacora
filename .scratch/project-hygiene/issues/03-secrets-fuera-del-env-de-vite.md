# Separar secretos de servicio del .env de Vite

**Status:** done

## Problema

`.env` mezcla las dos claves `VITE_*` (que lee Vite y van al cliente por diseño) con
`SUPABASE_SERVICE_ROLE_KEY` y `NOTION_TOKEN`. Está gitignoreado, así que no hay por dónde
filtrar hoy — pero si cualquier script o tooling del repo termina cargando el `.env` de Vite,
levanta la service_role también. Un `.env` no debería contener secretos que sobran para
todo lo que toca `import.meta.env`.

## Fix esperado

- `.env` se queda con `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (las únicas que
  el código cliente necesita).
- Mover `SUPABASE_SERVICE_ROLE_KEY` y `NOTION_TOKEN` a un archivo de tooling aparte
  (`.env.server` o el `.env` de `scripts/notion-import/` si el import es el único consumer).
- Actualizar `.env.example` con las dos secciones separadas + un comentario de que las de
  servicio NUNCA en el `.env` que lee Vite.
- Chequear quién lee `NOTION_TOKEN`/`SERVICE_ROLE` hoy (probablemente los scripts de import)
  y apuntarlos al archivo nuevo.

## Resolución

Reducido por decisión del spec: grep verificó que nadie lee `SUPABASE_SERVICE_ROLE_KEY` ni
`NOTION_TOKEN` (solo aparecen en docs). Sin `.env.server`. `.env.example` ahora solo tiene
las dos `VITE_*` + comentario de que los secretos de servicio nunca van en el `.env` de Vite.

Pasos manuales pendientes (usuario):
1. Borrar `SUPABASE_SERVICE_ROLE_KEY` y `NOTION_TOKEN` del `.env` real (gitignoreado).
2. Revocar el token de Notion en su panel de integraciones.
