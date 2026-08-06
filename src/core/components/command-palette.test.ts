import { filterActions, type Action } from "@/core/components/command-palette"

const a = (group: string, label: string): Action => ({ group, label, run: () => {} })

test("matchea por palabras sueltas (grupo incluido) y corta en 50", () => {
  const actions = [a("Notas", "Hooks en React"), a("Cursos", "React"), a("Navegar", "Ir a Hoy")]

  // Orden invertido respecto del label: matchea igual porque son palabras, no substring del todo.
  expect(filterActions(actions, "react hooks").map((x) => x.label)).toEqual(["Hooks en React"])
  // El grupo es parte del heno: "notas" trae las notas aunque no esté en ningún label.
  expect(filterActions(actions, "notas").map((x) => x.label)).toEqual(["Hooks en React"])
  expect(filterActions(actions, "zzz")).toEqual([])

  const many = [
    a("Navegar", "Ir a Hoy"),
    ...Array.from({ length: 200 }, (_, i) => a("Notas", `Nota ${i}`)),
  ]
  // Sin query: el grupo chico entero + las últimas 5 notas. Con query: tope de 50.
  expect(filterActions(many, "").map((x) => x.label)).toEqual([
    "Ir a Hoy",
    ...[195, 196, 197, 198, 199].map((i) => `Nota ${i}`),
  ])
  expect(filterActions(many, "nota").length).toBe(50)
})
