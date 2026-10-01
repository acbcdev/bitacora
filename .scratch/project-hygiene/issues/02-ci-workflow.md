# CI: workflow mínimo de GitHub Actions

**Status:** needs-triage

## Problema

No hay `.github/workflows/`. La única verificación es el husky pre-commit local — un
commit con `--no-verify` pasa desapercibido y puede romper main sin que nadie lo sepa.

## Fix esperado

Workflow mínimo en push + PR a main:

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test
```

Skip: build (`tsc -b && vite build`) — typecheck ya cubre tipos; agregarlo solo si
vite build empieza a fallar distinto de tsc.
