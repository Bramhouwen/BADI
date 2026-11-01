"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/app/actions/notifications";

export function MarkNotificationsRead() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(async () => {
      await markNotificationsRead();
      router.refresh();
    }, 1500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
