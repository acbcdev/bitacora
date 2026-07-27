import { render } from "@testing-library/react"
import { CourseIcon } from "@/components/course-icon"

test("dibuja preset, imagen subida, y nada si el valor no sirve", () => {
  const { container, rerender } = render(<CourseIcon icon="lucide:Book" />)
  expect(container.querySelector("svg")).toBeInTheDocument()

  rerender(<CourseIcon icon="https://x.supabase.co/storage/v1/object/public/course-icons/a/b" />)
  expect(container.querySelector("img")).toBeInTheDocument()

  // Sin icono, preset inexistente, y una clave heredada de Object: los tres, nada.
  for (const icon of [null, "lucide:NoExiste", "lucide:constructor"]) {
    rerender(<CourseIcon icon={icon} />)
    expect(container).toBeEmptyDOMElement()
  }
})
