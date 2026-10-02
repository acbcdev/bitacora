# Inversión de dependencia: core/components importa módulos de pantallas

**Status:** needs-triage

## Problema

`src/core/components/sidebar.tsx:16-18` importa tres módulos del feature de pantallas:

```ts
import { NotebookIcon } from "@/notebooks/notebook-icon"
import { useUpdateNotebook } from "@/notebooks/notebooks.api"
import { togglePinnedNotebook, usePinnedNotebookIds } from "@/notebooks/pinned-notebooks"
```

La dirección de la app es pantalla → core (las pantallas consumen `store`, `derive`, `ui`); acá un
módulo de core consume un feature de pantalla. HoY no hay ciclo, pero cualquier cambio en esos
módulos de notebooks puede romper el core, y mover `sidebar.tsx` a una pantalla no es trivial
(app.tsx lo monta como chrome global).

## Qué decide el triage

Opciones (no excluyentes):

1. Mover `notebook-icon` y `pinned-notebooks` a `core/components/` o `core/lib/` (son genéricos:
   un ícono con tintes y un pin de ids en localStorage).
2. Extraer el item de notebook del sidebar a `notebooks/` (el feature se autoregistra).
3. Dejarlo documentado como excepción aceptada (el sidebar ES el chrome de notebooks).

## Criterio

- Lo que se mueva, se mueve con su test; sin cambio de comportamiento.
- No cruza el seam `Store`.
