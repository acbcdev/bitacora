# 11 — Sidebar sobre el `sidebar` del registry

Status: ready-for-agent
Blocked by: 01

## Qué

`sidebar.tsx` mantiene a mano **dos árboles JSX completos** — uno para el rail colapsado y otro para
el expandido — más el estado de colapso en localStorage. Reemplazarlo por el `sidebar` del registry
deja un solo árbol y el colapso manejado por el provider.

⚠️ **Costo real, anotado a propósito:** este componente arrastra `sheet`, `tooltip`, `use-mobile`,
`separator` y `skeleton` para reemplazar 139 líneas que ya hacen exactamente lo que la app necesita.
Va **antes** que `12` y `13` porque `SidebarMenuButton` ya trae su propio tooltip: hacerlo después
significaría tirar el trabajo de esos dos tickets dentro del sidebar.

## Aceptación

- [ ] Un solo árbol JSX — el estado colapsado sale del provider, no de un `if` con dos `return`.
- [ ] Colapsar/expandir se persiste entre recargas (localStorage actual o la cookie del registry, cualquiera sirve).
- [ ] Siguen presentes: nav (Hoy, Cursos), lista de cursos activos, racha, hints de ⌘K y `?`, toggle de tema y salir.
- [ ] `aria-current="page"` sigue marcando la ruta activa en ambos estados.
- [ ] Colapsado, cada item muestra su nombre en un tooltip.
- [ ] El focus mode de Nota sigue escondiendo el sidebar entero.
- [ ] La lista de cursos activos sigue scrolleando sola sin empujar la racha fuera de vista.
