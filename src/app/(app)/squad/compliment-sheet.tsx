"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Send } from "lucide-react";
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

  function close() {
    onClose();
    setTimeout(() => {
      setSent(false);
      setMessage("");
      setCustom("");
      setError(null);
    }, 300);
  }

  /** One tap on a preset sends it right away; own text goes through the button. */
  function send(text: string) {
    const body = text.trim();
    if (!body) {
      setError("Kies een compliment of schrijf er zelf een.");
      return;
    }
    setError(null);
    setMessage(body);
    start(async () => {
      const r = await sendCompliment({ receiver_id: receiver.id, message: body });
      if (!r.ok) setError(r.error);
      else {
        setSent(true);
        setTimeout(close, 1400);
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
            <p className="text-[12.5px] text-muted">Tik op een compliment om het direct te versturen.</p>
            <div className="grid grid-cols-1 gap-2" role="group" aria-label="Kies een compliment">
              {PRESET_COMPLIMENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={pending}
                  onClick={() => send(c)}
                  className={cn(
                    "glass flex items-center justify-between rounded-[18px] px-4 py-3 text-left text-[14.5px] font-medium text-text transition hover:bg-blush/50 disabled:opacity-60",
                    pending && message === c && "bg-sage/20",
                  )}
                >
                  <span>{c}</span>
                  <Send className="h-4 w-4 text-muted" strokeWidth={1.7} aria-hidden />
                </button>
              ))}
            </div>
            <div>
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={140} placeholder="Of schrijf zelf iets..." aria-label="Eigen compliment" />
              <p className="mt-1 text-right text-xs text-muted">{custom.length}/140</p>
            </div>
            <ErrorText>{error}</ErrorText>
            <Button size="lg" className="w-full" onClick={() => send(custom)} loading={pending && message === custom.trim()} disabled={!custom.trim() || pending}>
              Stuur eigen compliment
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
