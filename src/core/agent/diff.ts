export type DiffLine = { type: "same" | "add" | "del"; text: string }

// Diff por línea con LCS (programación dinámica). Sin lib: las notas son chicas.
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.split("\n")
  const b = after === "" ? [] : after.split("\n")
  const lcs = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  )
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i++] })
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ type: "del", text: a[i++] })
    else out.push({ type: "add", text: b[j++] })
  }
  while (i < a.length) out.push({ type: "del", text: a[i++] })
  while (j < b.length) out.push({ type: "add", text: b[j++] })
  return out
}
