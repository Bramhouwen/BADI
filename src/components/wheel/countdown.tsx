"use client";

import { useEffect, useState } from "react";
import { countdownLabel } from "@/lib/wheel";

/** Time left until `target`, refreshed every 30 seconds. `serverNow` keeps the first render pure. */
export function Countdown({ target, serverNow }: { target: string; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{countdownLabel(Date.parse(target) - now)}</span>;
}
