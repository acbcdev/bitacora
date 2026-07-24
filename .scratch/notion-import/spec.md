# Feature: notion-import

**Status:** blocked (needs-info)
**Blocked by:** foundation, courses, notes  +  **bloqueo externo: el export real de Notion**

Último en el orden. Migra los 59 cursos (~1.500 notas) desde Notion. Es el código con **más riesgo
de corromper datos** — por eso va al final y no se escribe el parser adivinando.

## Por qué está bloqueado

El parser necesita el **export real** de Notion. Sin él, escribir el parser = adivinar nombres de
columnas = corromper 1.500 notas. **No escribir el parser hasta tener el export en mano.**

Export que se le pidió al usuario:

```
Notion → DB de cursos → ••• → Export
Format: Markdown & CSV · Include content: Everything · Create folders for subpages: ON
```

Sugerencia: exportar **UN curso típico** alcanza para diseñar el parser (2MB vs 200MB).

## Estructura conocida

- Una DB de cursos; **cada curso contiene una DB inline de notas.**
- Exporta como: carpeta por curso + un `.csv` de propiedades + un `.md` por nota.
- **Los nombres reales de columnas NO se conocen todavía.** Se completan al ver el export.

## Pendiente sin resolver: `started_at`

Los 59 cursos probablemente **no tienen `started_at`** en ningún lado. Propuesta (sin confirmar):
usar el `created_time` de Notion como aproximación + **flag `imported = true`** para marcar que las
fechas son estimadas. Decidir cuando llegue el export.

## Migración: todo, no parcial

El usuario quiere migrar **los 59 cursos completos**, no solo los activos. Migración parcial fue
descartada explícitamente.

## Riesgo / cómo trabajarlo

- Es el feature con más chance de corromper datos → cuando se escriba, pasarlo por `/code-review`.
- Idempotencia: correr el import dos veces no debe duplicar cursos/notas.

## Issues

Ninguno todavía — bloqueado hasta tener el export. El primer issue será **"diseñar el parser con
un export real de 1 curso"**.
