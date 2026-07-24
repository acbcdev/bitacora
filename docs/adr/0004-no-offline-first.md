# ADR 0004 — Sin offline-first, sin sync engine

**Status:** Accepted

## Contexto

El usuario empujó dos veces hacia offline-first / sync. Vale dejar cerrado por qué no va, para no
reabrirlo sin razón nueva.

## Decisión

La app es **online-only**. Sin cache offline, sin sync engine, sin resolución de conflictos.

## Por qué

- El uso real: el usuario **repasa** en el celular, **online**. Escribir/editar notas es en
  desktop, online. No hay un caso de uso offline concreto.
- Se investigó: **Supabase y D1 no traen offline-first**. Turso sí
  (`@tursodatabase/sync-wasm`), pero está en **beta** y Turso no trae auth (ver ADR 0001).
- Offline-first agrega sync bidireccional + conflict resolution = complejidad enorme para
  resolver un problema que no existe en este uso.

## Consecuencias

- Sin conexión, la app no funciona. Aceptable: es una herramienta de escritorio/casa/online.
- Si algún día aparece un caso offline real (viaje sin datos, etc.), se reabre **con ese caso
  concreto sobre la mesa**, no como preferencia arquitectónica.
