"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and the hydration pass, true afterwards.
 * Use it for values that only exist in the browser (clocks, localStorage) so
 * the first client render matches the server HTML.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
