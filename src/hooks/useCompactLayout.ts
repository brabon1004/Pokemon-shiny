import { useSyncExternalStore } from 'react'

/**
 * The phone layout's media query in app.css (a test checks they match). Short viewports count, so a phone turned
 * sideways keeps the phone layout and an open calculator sheet.
 */
export const COMPACT_LAYOUT_QUERY = '(max-width: 719.98px), (max-height: 500px)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(COMPACT_LAYOUT_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** True on phone-sized viewports, where the calculator lives in a bottom sheet instead of the sidebar. */
export function useCompactLayout(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT_LAYOUT_QUERY).matches)
}
