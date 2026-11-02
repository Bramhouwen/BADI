"use client";

import { useState } from "react";
import { HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComplimentSheet } from "../compliment-sheet";

export function ComplimentButton({ receiver }: { receiver: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="md" className="w-full" onClick={() => setOpen(true)}>
        <HandHeart className="h-4 w-4" strokeWidth={1.6} /> Geef compliment
      </Button>
      <ComplimentSheet open={open} onClose={() => setOpen(false)} receiver={receiver} />
    </>
  );
}
