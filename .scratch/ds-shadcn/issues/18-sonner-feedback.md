# 18 — Feedback de mutations con `Toaster`

Status: resolved
Blocked by: ninguno — se puede arrancar ya

## Qué

Hoy toda mutation que falla lo hace en silencio: crear/editar/borrar curso, crear/borrar nota,
marcar leído. El usuario ve que no pasó nada y no sabe por qué.

⚠️ **El registry trae `next-themes` como dependencia.** Esta app ya tiene su propio estado `dark`
con su toggle. Se cablea el `Toaster` a **ese** estado; `next-themes` no se instala.

## Aceptación

- [x] `Toaster` montado una sola vez en la raíz de la app.
- [x] Toda mutation que falla muestra un toast de error con el mensaje real del error, no uno genérico.
- [x] El tema del toast sigue el estado `dark` existente, y `next-themes` no aparece en `package.json`.
- [x] El éxito solo se avisa donde no hay feedback visual propio (borrar). Crear y editar ya se ven en la lista: ahí no va toast.
- [x] Marcar leído sigue siendo optimista — el toast de error no bloquea ni revierte el avance de la cola.

## Comments

Resuelto. `pnpm exec shadcn add sonner` (dep nueva: `sonner`). El `Toaster` se monta una sola vez, en
el `Shell` de `app.tsx`.

**`next-themes` se desinstaló** (`pnpm remove next-themes`): el registry lo trae y lo cablea con
`useTheme()`, pero esta app ya sabe si está en oscuro. `sonner.tsx` quedó como un wrapper fino sin
estado y el tema entra por prop desde el `Shell` (`<Toaster theme={dark ? "dark" : "light"} />`).

El toast de error va en un `MutationCache` global en `main.tsx`, no hook por hook:

```ts
new QueryClient({ mutationCache: new MutationCache({ onError: (e) => toast.error(e.message) }) })
```

Son seis mutations y ninguna necesita un mensaje propio — el mensaje real de Supabase es más útil que
cualquier texto que escribamos encima. Efecto lateral buscado: el autosave de notas, que también
fallaba en silencio, ahora avisa.

Toast de éxito solo en los dos borrados (`useDeleteCourse`, `useDeleteNote`), que es donde no hay otro
feedback visual. Crear y editar curso se ven en la lista, crear nota abre la nota: ahí no va nada.

`useMarkRead` no se tocó: el avance de la cola lo hace la pantalla Hoy en local y el toast cuelga del
`MutationCache`, así que un error avisa sin bloquear ni revertir el avance.
