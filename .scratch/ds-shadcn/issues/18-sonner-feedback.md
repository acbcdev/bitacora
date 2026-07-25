# 18 — Feedback de mutations con `Toaster`

Status: ready-for-agent
Blocked by: ninguno — se puede arrancar ya

## Qué

Hoy toda mutation que falla lo hace en silencio: crear/editar/borrar curso, crear/borrar nota,
marcar leído. El usuario ve que no pasó nada y no sabe por qué.

⚠️ **El registry trae `next-themes` como dependencia.** Esta app ya tiene su propio estado `dark`
con su toggle. Se cablea el `Toaster` a **ese** estado; `next-themes` no se instala.

## Aceptación

- [ ] `Toaster` montado una sola vez en la raíz de la app.
- [ ] Toda mutation que falla muestra un toast de error con el mensaje real del error, no uno genérico.
- [ ] El tema del toast sigue el estado `dark` existente, y `next-themes` no aparece en `package.json`.
- [ ] El éxito solo se avisa donde no hay feedback visual propio (borrar). Crear y editar ya se ven en la lista: ahí no va toast.
- [ ] Marcar leído sigue siendo optimista — el toast de error no bloquea ni revierte el avance de la cola.
