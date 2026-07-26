import "@testing-library/jest-dom"

// jsdom (29) no implementa layout ni ResizeObserver. Los stubs viven acá para no ensuciar el
// código de la app con guardas que en un browser real nunca hacen falta.
Element.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
