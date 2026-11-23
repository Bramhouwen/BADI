"use client";

import { useEffect, useState } from "react";

/** Types `text` out letter by letter once `start` is true; at once with `instant`. */
export function useTyped(text: string, start: boolean, instant: boolean, msPerChar = 28): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start || instant) return;
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), msPerChar);
    return () => clearInterval(id);
  }, [start, instant, text, msPerChar]);
  if (instant) return start ? text : "";
  return text.slice(0, n);
}
