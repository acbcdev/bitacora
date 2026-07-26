# 11 — Sidebar sobre el `sidebar` del registry

Status: resolved
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

- [x] Un solo árbol JSX — el estado colapsado sale del provider, no de un `if` con dos `return`.
- [x] Colapsar/expandir se persiste entre recargas (localStorage actual o la cookie del registry, cualquiera sirve).
- [x] Siguen presentes: nav (Hoy, Cursos), lista de cursos activos, racha, hints de ⌘K y `?`, toggle de tema y salir.
- [x] `aria-current="page"` sigue marcando la ruta activa en ambos estados.
- [x] Colapsado, cada item muestra su nombre en un tooltip.
- [x] El focus mode de Nota sigue escondiendo el sidebar entero.
- [x] La lista de cursos activos sigue scrolleando sola sin empujar la racha fuera de vista.

## Comments

Resuelto. `pnpm exec shadcn add sidebar` — arrastró `sheet`, `tooltip`, `separator`, `skeleton` y
`hooks/use-mobile.ts`, tal como avisaba el ticket.

Un solo árbol JSX: el `if (collapsed) return ...` con sus dos returns se fue. Lo que antes eran dos
markups ahora son las mismas 4 secciones (`SidebarHeader` / `SidebarContent` / `SidebarFooter`) y el
rail sale de `collapsible="icon"` + los `group-data-[collapsible=icon]:` del componente.

Decisiones:

- **Persistencia**: se queda el `localStorage` de App, no la cookie del registry. `SidebarProvider`
  se usa controlado (`open={!collapsed}` / `onOpenChange`), así que el toggle desde la command
  palette sigue funcionando sin duplicar estado. El provider igual escribe su cookie; es inofensiva.
- **Medidas**: `--sidebar-width: 216px` y `--sidebar-width-icon: 56px` por `style` en el provider,
  para no cambiar el ancho de la app (el registry trae 16rem / 3rem).
- **Ruta activa**: `NavLink` sigue poniendo `aria-current="page"` y el estilo cuelga de ahí
  (constante `ACTIVE`). Se prefirió eso a pasarle `isActive` a `SidebarMenuButton`, que obligaría a
  recalcular el match de ruta a mano.
- **Tooltips colapsado**: prop `tooltip` de `SidebarMenuButton`, que ya los esconde solo cuando el
  sidebar está expandido. El `TooltipProvider` de la raíz lo puso el ticket `13`.
- **Scroll**: el grupo de cursos activos lleva `min-h-0 overflow-y-auto`. Sin `min-h-0` un flex item
  no baja de su contenido y el footer (racha, tema, salir) se iba abajo del viewport.
- **Focus mode**: sigue siendo el `{!focus && <Sidebar />}` de App, sin cambios.

Dos cosas que entraron de arriba con el componente, ninguna pedida: `⌘B` togglea el sidebar, y en
viewports chicos (`< md`) el sidebar se vuelve un `Sheet` en vez de estar siempre visible.

Una modificación al archivo del registry: `setOpen((open) => !open)` → `(prev) => !prev`, porque
`oxlint --deny-warnings` no pasa con el shadowing.
