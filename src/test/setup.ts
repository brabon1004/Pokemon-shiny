// jsdom implements neither matchMedia nor HTMLDialogElement.showModal/close, so tests get small stand-ins.
import { afterEach } from 'vitest'

let isCompactViewport = false

/** Makes every media query match (a phone-sized viewport) until the current test ends. */
export function emulateCompactViewport(): void {
  isCompactViewport = true
}

afterEach(() => {
  isCompactViewport = false
})

window.matchMedia = (query: string): MediaQueryList => ({
  matches: isCompactViewport,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})

HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.open) return
  this.open = false
  this.dispatchEvent(new Event('close'))
}
