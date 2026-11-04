"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/field";
import { decimalText, parseDecimal } from "@/lib/fitness";

/**
 * Number field that accepts a comma. It keeps the text as typed, so "22," stays
 * on screen while you type 22,5; the parent gets the number (or null).
 */
export function DecimalInput({ value, onValue, max = 1000, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & { value: number | null; onValue: (v: number | null) => void; max?: number }) {
  const [text, setText] = useState(() => decimalText(value));
  const [seen, setSeen] = useState(value);
  // A new value from outside (another set copied, a reset) replaces the text.
  if (value !== seen) {
    setSeen(value);
    if (parseDecimal(text) !== value) setText(decimalText(value));
  }
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,]/g, "");
        const num = parseDecimal(raw);
        const next = num === null ? null : Math.max(0, Math.min(max, Math.round(num * 100) / 100));
        setText(raw);
        setSeen(next);
        onValue(next);
      }}
    />
  );
}
