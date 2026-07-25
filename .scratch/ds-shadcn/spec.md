# Feature: ds-shadcn

**Blocked by:** ninguno

Alinear la UI con el registry de shadcn (`radix-nova`) que ya está configurado en `components.json`
y nunca se usó del todo. Hoy compiten tres fuentes de verdad para lo mismo:

1. componentes en `src/components/ui/`,
2. clases utilitarias en `index.css` (`.icon-btn`, `.panel`, `.nav-item`, `.row-link`),
3. markup a mano en las páginas (barras de progreso, inputs con icono, estados vacíos).

**No es un rediseño.** Ningún ticket cambia comportamiento: cambia de dónde sale el estilo y qué
semántica expone el DOM. Cada ticket tiene que verse igual antes y después, salvo donde el criterio
de aceptación diga lo contrario.

## Scope

- **Primitivas que faltan**: `progress`, `input-group`, `native-select`, `field`, `skeleton`,
  `table`, `toggle-group`, `dropdown-menu`, `tooltip`, `card`, `item`, `dialog`, `alert-dialog`,
  `command`, `sonner`, `sidebar`.
- **Duplicación propia**: `.icon-btn` replica `Button variant="ghost" size="icon-sm"`.
- **Código muerto**: `src/components/ui/empty.tsx` está instalado y no lo importa nadie.

## Reglas

- Ninguna dep npm nueva salvo donde el ticket la nombre explícitamente (`cmdk` en `16`,
  `sonner` en `18`). `radix-ui` ya está instalado y cubre el resto.
- Al agregar un componente del registry se respeta el estilo `radix-nova` de `components.json` — no
  se pega código de la doc pública, se usa `pnpm exec shadcn add`.
- El registry referencia `IconPlaceholder`; al instalar hay que reemplazarlo por el icono de
  `lucide-react` que corresponda (`iconLibrary: lucide`).
- Cada ticket deja `pnpm typecheck`, `pnpm lint` y `pnpm test` en verde por su cuenta.

## Riesgos anotados

- **`15` (dialog)** revierte una decisión existente: `modal.tsx` usa `<dialog>` nativo por
  ui-principles #5 (focus trap, Esc y backdrop gratis, sin lib). Se toma a propósito para destrabar
  `16`, no por limpieza.
- **`11` (sidebar)** arrastra `sheet`, `tooltip`, `use-mobile`, `separator` y `skeleton` para
  reemplazar 139 líneas que ya hacen exactamente lo que se necesita. Va primero que `12` y `13`
  justamente para no tirar el trabajo de esos dos.
- **`18` (sonner)** trae `next-themes` en el registry. Esta app ya tiene su propio estado `dark`:
  se cablea a ese, `next-themes` no se instala.

## Fuera de scope

- Cambiar tokens del design system (`index.css` `@theme`), tipografías o paleta.
- Cualquier cambio de comportamiento de dominio (soft delete, cola de repaso, autosave).
- Tocar `editor.tsx` / Tiptap.

## Issues

- `01` `.icon-btn` muere, `Button` manda
- `02` barras de progreso con semántica
- `03` `Empty` deja de ser código muerto
- `04` skeletons en vez de pantalla en blanco
- `05` input con icono, una sola vez
- `06` selects nativos estilados por el DS
- `07` `Field` en los formularios
- `08` tabla de cursos sobre `Table`
- `09` switcher tabla/tarjetas como `ToggleGroup`
- `10` acciones de fila en `DropdownMenu`
- `11` sidebar sobre el `sidebar` del registry
- `12` `Item` para lo que queda de `.nav-item`
- `13` `Tooltip` en vez de `title=`
- `14` `Card` para lo que queda de `.panel`
- `15` `Dialog` de radix en vez de `<dialog>` nativo
- `16` command palette sobre `cmdk`
- `17` `AlertDialog` en vez de `confirm()`
- `18` feedback de mutations con `Toaster`
