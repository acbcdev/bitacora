import "@testing-library/jest-dom"

// jsdom (29) no implementa layout ni <dialog>.showModal/close. Los stubs viven acá para no
// ensuciar el código de la app con guardas que en un browser real nunca hacen falta.
Element.prototype.scrollIntoView = () => {}
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event("close"))
}
