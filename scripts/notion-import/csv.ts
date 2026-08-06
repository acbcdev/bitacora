export type CsvValue = string | number | boolean | null
export type CsvRow = Record<string, CsvValue>

// Destino: `copy ... from '...' with (format csv, header)`. En CSV mode Postgres lee un campo vacío
// sin comillas como NULL y `""` como string vacío — por eso el texto va SIEMPRE entrecomillado y
// null se escribe como nada. Comillas dobladas, y los saltos de línea (JSON de Tiptap) viajan
// crudos adentro de las comillas, que es lo que el formato espera.
export function csvCell(value: CsvValue): string {
  if (value === null) return ""
  if (typeof value === "string") return `"${value.replaceAll('"', '""')}"`
  return String(value)
}

export function toCsv(rows: CsvRow[]): string {
  if (!rows.length) return ""
  const cols = Object.keys(rows[0])
  const lines = rows.map((row) => cols.map((col) => csvCell(row[col])).join(","))
  return [cols.join(","), ...lines].join("\n") + "\n"
}
