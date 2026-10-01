# Push de main: 33 commits sin respaldo

**Status:** needs-triage

## Problema

`main` va 33 commits adelante de `origin/main`. Todo eso vive solo en el disco local —
un problema de disco o un `reset` accidente pierde trabajo. También hace imposible
review incremental.

## Fix esperado

`git push` regular (fin de sesión como hábito). Si el problema es que main se usa como
rama de trabajo personal, es correcto así para proyecto solo — lo que no es correcto es
acumular semanas sin push. Nada de branching siquiendo para solo-dev。
