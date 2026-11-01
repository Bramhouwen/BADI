"use client";

import { useEffect } from "react";
import { markComplimentsRead } from "@/app/actions/compliments";

/** Marks unread compliments as read once the inbox has been viewed. */
export function MarkRead() {
  useEffect(() => {
    const t = setTimeout(() => {
      markComplimentsRead();
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
