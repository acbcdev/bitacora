export type Section = "repaso" | "habitos" | "notebooks"

// Qué parte del área visible (bajo la barra) marca el cambio de sección: 0.5 = la sección nueva
// cambia el título cuando ocupa más de la mitad de la pantalla. 0 sería "recién al llegar arriba".
export const SWITCH_AT = 0.5

// Título de la barra mobile: la última sección cuya cabecera ya cruzó la línea de cambio
// (top <= line). Sin cabeceras cruzadas = Repaso (su header en flujo está oculto en mobile).
export function currentSection(heads: { section: Section; top: number }[], line: number): Section {
  let cur: Section = "repaso"
  for (const h of heads) if (h.top <= line) cur = h.section
  return cur
}

// Línea de cambio en coordenadas de viewport: SWITCH_AT del alto visible, contado desde la barra.
export const switchLine = (barBottom: number, viewBottom: number) =>
  barBottom + (viewBottom - barBottom) * SWITCH_AT
