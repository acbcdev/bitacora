# Mobile

**Status:** grillado 2026-06 (esta sesión) — **no spec-ear hasta tener uso real.**

## Decisión del grill

"Optimizar mobile" del grill de plataforma (batch 2026-06, hoy repartido en `.scratch/` por feature) estaba respaldado por ADR 0004, pero el
supuesto de ese ADR ("el usuario **repasa en el celular**, online") **no es un hecho: el usuario
nunca usó Repaso en el celu**. Spec-ear hoy sería spec sobre supuestos.

**Decisión:** trial en celu primero. Usar Repaso en el celular durante una semana real, anotar qué
duele, y recién ahí spec-ear. Cero código hasta entonces, salvo bugs conocidos (ver issues/).

ADR 0004 debe actualizarse cuando haya datos reales: el supuesto estaba sin verificar.

## Conocido antes del trial

- El trigger del sidebar mobile scrollea con el contenido y se pierde →
  `issues/01-sidebar-trigger-scroll.md`.
