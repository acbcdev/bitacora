import "@testing-library/jest-dom"

// jsdom (29) no implementa layout ni ResizeObserver. Los stubs viven acá para no ensuciar el
// código de la app con guardas que en un browser real nunca hacen falta.
Element.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// jsdom no implementa matchMedia. use-mobile.ts decide por innerWidth (jsdom default: 1024,
// desktop) — este stub solo evita el "not implemented" al montar, el listener no hace falta.
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia
