---
description: Crea un worktree local con el nombre indicado.
---

Ejecuta exactamente este único comando y nada más:

```sh
git worktree add ".worktrees/$ARGUMENTS"
```

Usa todo `$ARGUMENTS` como nombre del worktree, incluidos los espacios. No cambies de directorio, no ejecutes comprobaciones y no realices ninguna otra acción.
Analiza el argumento y si contiene espacios deriva un nombre corto en kebab-case.
Si los argumentos son muy largos, simplificalos.
