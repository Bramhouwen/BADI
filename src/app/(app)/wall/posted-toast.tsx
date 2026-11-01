"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export function PostedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (params.get("posted") === "1") {
      toast("Geplaatst op de Wall. Inspirerend! 📸", "success");
      router.replace("/wall");
    }
  }, [params, router, toast]);
  return null;
}
