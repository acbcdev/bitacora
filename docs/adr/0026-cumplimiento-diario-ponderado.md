# ADR 0026 — Cumplimiento diario ponderado (parcial + semana/mes por ritmo)

**Status:** Accepted — enmienda la exclusión de semana/mes del Cumplimiento diario (CONTEXT.md, ADR 0013)

## Contexto

Las barras del header de Hoy medían `cumplidos / total` sobre los hábitos `day`, con `meets()`
binario. Dos huecos: un `count` en 1/3 pesaba lo mismo que 0, y un hábito semanal o mensual no
movía la barra aunque se hiciera ese día.

## Decisión

- **Altura = progreso ponderado.** `good` aporta `min(acumulado / esperado, 1)`; `bad` queda
  binario ("medio recaí" no existe).
- **Semana/mes por ritmo, no por día suelto.** Esperado = `target × fracción del período
  transcurrida al cerrar ese día` (mar = 2/7 de la semana). Se descartaron dos convenciones:
  repartir `target/7` por día (castiga los días de descanso de un 3/semana) y el acumulado contra
  el target entero (todo lunes sale bajo).
- **Peso** `day 1 · week 0.5 · month 0.25`: un día es una fracción chica de su período.
- **El verde no cambia**: sólo si todos los `day` cumplieron. Un semanal no tiene un "cerrado"
  honesto por día.

## Consecuencias

- Ir atrasado en un semanal **baja** la barra; ir al ritmo o adelantado la llena.
- `ComplianceDay` suma `progress`; `met/total` queda sólo para el verde.
