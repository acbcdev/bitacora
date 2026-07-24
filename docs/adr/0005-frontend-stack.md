# ADR 0005 — Stack de frontend (routing, data, styling, PWA, testing)

**Status:** Accepted

## Contexto

El stack de alto nivel (Vite + React + Tiptap + Supabase → PWA en Cloudflare Pages) estaba
cerrado, pero faltaban las decisiones de nivel medio que cada feature asume. App de **3 pantallas**,
solo-dev, felt-need = **rápida y keyboard-first** (no un component library pulido).

## Decisión

| Área | Elección | Por qué |
|---|---|---|
| **Routing** | React Router | Deep-link a nota/curso + botón atrás en la PWA. Un state-switch para 3 pantallas se rompe al querer bookmarkear una nota. |
| **Data / estado servidor** | **TanStack Query** | Ver abajo — la arquitectura derive-everything lo justifica, no es especulativo. |
| **Styling** | Tailwind + **Radix** (vía **shadcn/ui**) | Componentes accesibles con **nav por teclado gratis** (encaja con keyboard-first). shadcn copia los componentes al repo — se editan, no son una dep opaca. |
| **PWA** | `vite-plugin-pwa` | Una línea de config. |
| **Testing** | Vitest | Nativo de Vite. |
| **Package manager** | pnpm | Rápido. Sin impacto en el código. |

## Por qué TanStack Query y no raw `supabase-js`

El ADR 0003 define **todo derivado de `read_log`**. Cada `Space` en la pantalla de repaso inserta
en `read_log`, y **progreso + cola + racha** tienen que reflejar el cambio. Con raw supabase-js eso
es refetch manual en varios lugares por cada mutación. Con Query es `invalidateQueries(['read_log'])`
y todo lo derivado se recalcula solo. La **invalidación de cache es una necesidad central
recurrente** de esta app, no un lujo → Query es la herramienta correcta desde el día uno.

## Lo que NO se hace (anti over-engineering)

- **Sin design system formal:** no tokens propios, no Storybook, no biblioteca de componentes
  documentada. Es una app de 3 pantallas personal — un design system sería 40h de yak-shaving
  contra el simplicity-first. Las guías visuales viven en `docs/ui-principles.md` (un doc corto),
  no en un sistema.
- **Sin state manager global** (Redux/Zustand): TanStack Query cubre estado de servidor; el estado
  de UI local va en `useState`. Se reevalúa solo si aparece estado global real (no está en scope).

## Consecuencias

- shadcn/ui necesita el alias de imports configurado en Vite (`@/`) — parte del setup de
  `foundation`.
- Las mutaciones (insert en `read_log`, CRUD) invalidan las queries derivadas relevantes. Es el
  patrón por defecto para toda escritura.
