"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export function WelcomeToast() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (params.get("welcome") === "1") {
      toast("Welkom in de squad! Better together. ❄️", "success");
      router.replace("/");
    }
  }, [params, router, toast]);
  return null;
}
