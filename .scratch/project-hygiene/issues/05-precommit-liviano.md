# Pre-commit más liviano: full suite a CI

**Status:** needs-triage

## Problema

`.husky/pre-commit` corre `format:check + lint + typecheck + test` = suite completa
(~30s y creciendo: 287 tests hoy). Con 500 tests la gente empieza a commitear con
`--no-verify`, que anula toda la red.

## Fix esperado

Opción lazy: pre-commit = `format:check + lint + typecheck` (rápidos, ~5s) y la suite
completa solo en CI (ver issues/02). Los tests de archivos tocados en pre-commit es
frágil en vitest (mapear staged → tests); no vale la complejidad.

Alternativa si se quiere tests en pre-commit: `vitest related --run` sobre los staged.
Empezar por la opción simple; medir si de verdad duelen los false-negative de pre-commit
antes de la segunda.

Bloqueado por issues/02 (CI tiene que existir antes de quitar tests del pre-commit).
