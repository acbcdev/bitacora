# 04: Auto-scroll del Marquee

**What to build:** Durante un Marquee, si el puntero queda a ≤40px del borde superior o inferior del contenedor scrolleable de la nota, la nota scrollea a paso fijo (sin aceleración) mientras el puntero siga ahí, y la selección se sigue recalculando con el scroll — así se seleccionan más bloques de los que caben en pantalla. Al soltar o salir de la franja, el scroll para.

Spec: `.scratch/block-selection/spec.md` (historia 16).

**Blocked by:** 03 (Marquee básico)

**Status:** ready-for-agent

- [ ] En una nota más larga que la pantalla, Marquee hasta el borde inferior scrollea y suma bloques (verificado a mano)
- [ ] Idem hacia arriba
- [ ] Soltar el mouse detiene el scroll; no queda loop de rAF vivo
