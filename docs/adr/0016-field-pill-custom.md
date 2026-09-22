# ADR 0016 — FieldPill custom en vez de Combobox de Base UI

**Status:** Accepted

## Contexto

El pill de Fuente/Área del form de notebooks (`notebook-form.tsx`) estaba construido sobre
`Combobox` de `@base-ui/react` (el viejo `PillCombobox`) y acumuló parches frágiles:

- El dropdown no scrolleaba dentro del modal: la CSS var `--available-height` de Base UI no se
  seteaba en el popup portaleado al dialog, y quedó parchado con un fallback.
- El Radix Dialog modal pone `pointer-events: none` en body; el popup portaleado a body necesitó
  un parche propio (`pointer-events-auto`).
- Para abrir el combo en tests hubo que disparar la secuencia completa de Base UI
  (pointerdown + mousedown + click + focus) en vez de un `focus()` simple.
- El ancho del popup dependía de `--anchor-width`, otra var runtime.

## Decisión

**1. Componente custom `FieldPill` (`src/core/ui/field-pill.tsx`), sin portal ni dependencias de
popover.** Pill con `<input>` libre + dropdown propio `absolute` dentro del modal, no portaleado:

- Scroll con `max-h` estático (`max-h-72`), clicable sin parches de pointer-events.
- El gesto de abrir es el focus/click simple del input (en tests basta `fireEvent.focus`).
- El ancho del popup es CSS puro (`w-max min-w-full`), sin vars runtime.

**2. Semántica de combobox editable con foco fijo en el input.** `role="combobox"` + `role="listbox"`
en el dropdown + `aria-activedescendant` apuntando a `id={`${id}-option-${i}`}` de la opción
destacada. Se descartó roving tabindex: rompe el tipeo en un combobox con input libre — el foco
nunca sale del input.

**3. Escape en dos niveles.** Con el dropdown abierto, Escape lo cierra y el modal queda;
cerrado, el Escape fluye hasta el Dialog y lo cierra. Detalle de implementación que el diseño
original subestimó: el DismissableLayer de Radix escucha `keydown` en **capture** en `document` y
sólo respeta `defaultPrevented` — un `stopPropagation` (o un `preventDefault` en el handler del
input) llega tarde, porque el capture de document corre antes de que el evento toque el árbol del
form. La intercepción vive en capture en `window` (antes del capture de document) y marca
`defaultPrevented`: Radix ve la marca y no cierra el modal.

**4. El dot es la identidad del valor** (`dotColor(value)`, hash determinista sobre una paleta de
12): aparece siempre que hay valor — chip, opciones del dropdown y footer del form — y no hay prop
`showDot` ni lógica de "par fuente+área completo".

**5. Enter con dos significados.** Enter sobre una opción destacada la selecciona
(`preventDefault`). Enter sin match no se toca: submittea el form y el valor tipeado queda como
fuente/área nueva (texto libre, manda el schema).

**6. Búsqueda interna, separada del valor.** El valor confirmado (`value`) es lo que el pill
muestra y lo que manda el form. Lo tipeado va a un estado interno `search` que sólo filtra la
lista; confirmar (elegir una opción, Enter sin match, o click afuera) lo manda a `value` y lo
limpia. Escape descarta la búsqueda sin tocar el valor. Sin × y sin chips: el pill es sobrio
(icono + texto, `bg-secondary` con valor) y el dot de color vive sólo como identidad de cada
opción en la lista. Con búsqueda sin matches, la lista ofrece “Crear «búsqueda»” (con el dot de
color que le tocaría): el click crea igual que el Enter.

**7. Fix de stacking.** El dropdown vivía debajo de los botones del footer: el footer es hermano
posterior con background y ganaba el orden de pintado pese al `z-50` del popup. Con el dropdown
abierto, la raíz del pill eleva su stacking context (`z-10`) y el popup cubre todo el modal.

## Consecuencias

- Murió la dependencia de `Combobox`/`PillCombobox` para estos campos: sin portal, sin vars
  runtime, sin parches de pointer-events, y los tests abren el dropdown con un `focus`.
- El input del pill es uno solo para los dos estados (valor confirmado y búsqueda): el nodo
  sobrevive y el foco no se pierde al confirmar.
- Al confirmar por click afuera (mousedown en "Guardar", otro pill, etc.) la búsqueda pendiente
  se manda a `value` — nada de lo tipeado se pierde; Escape es la única salida que descarta.
- Ubicación: `src/core/ui/` como input genérico, aunque hoy tenga un solo consumidor
  (`notebook-form.tsx`).
