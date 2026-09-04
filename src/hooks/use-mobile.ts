import * as React from "react"

const MOBILE_BREAKPOINT = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

/**
 * viewport が mobile 幅かどうか。
 *
 * effect + setState ではなく useSyncExternalStore を使う。初回 render で
 * 既に正しい値が取れるので undefined→false→true の連鎖 render が起きず、
 * SSR(scripts/render-smoke.tsx)では getServerSnapshot の false になる。
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
