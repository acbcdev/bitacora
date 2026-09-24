# Tonos de nota (AI rewrite del cuerpo)

**Status:** resuelto como idea 2026-09-23 (grill confirmado por el usuario, decisión por decisión). Sin spec de implementación. Definición viva del término en `CONTEXT.md` ("Tono (NO construido)").

## Qué

Reescribe el **cuerpo** de la nota con AI según tono. Nunca el título (es la referencia mental del notebook).

**Presets:** seis fijos con prompt a medida — Claro y directo · Más conciso · Paso a paso · Resumen ejecutivo · Para principiante · Corregir ortografía/gramática. Tonos propios guardados: **explícitamente después del MVP**.

**UI:** split-button en el header de la pantalla Nota, al lado del `···` de `note-actions.tsx`: click = último tono usado / default; chevron = menú con los seis. No en Repaso (dialog de sólo lectura) y no dentro del editor — no existe toolbar y ADR 0017 dice "las letras escriben".

**Flujo agent-style (decisión clave del usuario: "como los agents que modifican un archivo, pero la nota es el archivo"):**

1. Draft actual → `docToMarkdown`
2. Edge Function nueva `rewrite-note` (patrón de ADR 0010: JWT del usuario, key server-side, RLS intacta)
3. Markdown reescrito → **diff rojo/verde contra el draft**
4. Aceptar todo o nada (un solo bloque de decisión, no por hunk) → reemplaza content → autosave de siempre (ADR 0015 se aplica igual)

Descartar = no pasa nada. El editor queda bloqueado mientras el diff está en pantalla.

**Modo:** requiere Edge Function → **Supabase-only como las flashcards**. El rename de `canGenerateFlashcards` → flag genérico queda para el día de implementar (no es parte del MVP).

**Infra reutilizable:** el round-trip markdown⇄Tiptap ya existe (`tiptap-markdown.ts`), así que la feature es adapter + diff + UI, cero serializador nuevo.

## Historia del grill

Originalmente (2026-07-30) frenaba por el mismo costo y arquitectura que el sidebar AI. Con la Edge Function de flashcards en producción, el problema de arquitectura dejó de existir: queda solo el costo, acotado mientras sea un botón explícito. No agrega pantalla nueva (vive en Nota, una de las 3 aprobadas) — menor fricción con `ui-principles.md` en ese eje. Vigilar cuántos botones entran al editor: "chrome mínimo" aplica igual ahí adentro.
