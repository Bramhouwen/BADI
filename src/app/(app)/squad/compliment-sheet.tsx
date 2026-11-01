"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorText, Input } from "@/components/ui/field";
import { PRESET_COMPLIMENTS } from "@/lib/constants";
import { sendCompliment } from "@/app/actions/compliments";
import { cn } from "@/lib/utils";

export function ComplimentSheet({ open, onClose, receiver }: { open: boolean; onClose: () => void; receiver: { id: string; name: string } }) {
  const [message, setMessage] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const reduce = useReducedMotion();

  const text = custom.trim() || message;

  function close() {
    onClose();
    setTimeout(() => {
      setSent(false);
      setMessage("");
      setCustom("");
      setError(null);
    }, 300);
  }

  function send() {
    if (!text) {
      setError("Kies een compliment of schrijf er zelf een.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await sendCompliment({ receiver_id: receiver.id, message: text });
      if (!r.ok) setError(r.error);
      else {
        setSent(true);
        setTimeout(close, 1600);
      }
    });
  }

  return (
    <Sheet open={open} onClose={close} title={`Compliment voor ${receiver.name}`}>
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="sent" initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
            <motion.div
              initial={reduce ? false : { scale: 0.4 }}
              animate={{ scale: [0.4, 1.2, 1] }}
              transition={{ duration: 0.5 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#fb7185]/15 text-4xl"
            >
              <span aria-hidden>❤️</span>
            </motion.div>
            <p className="mt-4 text-lg font-semibold">Verstuurd!</p>
            <p className="text-sm text-muted">{receiver.name} ziet je compliment meteen in de app.</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={false} className="space-y-4 pb-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Kies een compliment">
              {PRESET_COMPLIMENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={message === c && !custom}
                  onClick={() => {
                    setMessage(c);
                    setCustom("");
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                    message === c && !custom ? "tile border-transparent" : "border-white/20 bg-white/5 text-text/90 hover:bg-white/15",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <div>
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={140} placeholder="Of schrijf zelf iets liefs..." aria-label="Eigen compliment" />
              <p className="mt-1 text-right text-xs text-muted">{custom.length}/140</p>
            </div>
            <ErrorText>{error}</ErrorText>
            <Button size="lg" className="w-full" onClick={send} loading={pending}>
              Stuur compliment
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
