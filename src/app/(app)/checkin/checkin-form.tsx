"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Trash2 } from "lucide-react";
import { ACTIVITIES, type ActivityKey } from "@/lib/constants";
import { formatDateNl } from "@/lib/dates";
import { isMilestone, type StreakStats } from "@/lib/streaks";
import type { DailyCheckin } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorText, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { deleteCheckin, saveCheckin } from "@/app/actions/checkins";

interface Props {
  dates: string[]; // [today, yesterday?]
  today: string;
  existing: Record<string, DailyCheckin>;
  stats: StreakStats;
}

type Success = { streak: number; longest: number; milestone: boolean; created: boolean };

export function CheckinForm({ dates, today, existing, stats }: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [date, setDate] = useState(dates[0]);
  const current = existing[date];
  const [selected, setSelected] = useState<Set<ActivityKey>>(new Set(current?.activities ?? []));
  const [note, setNote] = useState(current?.note ?? "");
  const [showNote, setShowNote] = useState(Boolean(current?.note));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [success, setSuccess] = useState<Success | null>(null);

  function switchDate(d: string) {
    setDate(d);
    const ex = existing[d];
    setSelected(new Set(ex?.activities ?? []));
    setNote(ex?.note ?? "");
    setShowNote(Boolean(ex?.note));
    setError(null);
  }

  function toggle(key: ActivityKey) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function submit() {
    if (selected.size === 0) {
      setError("Kies minimaal één ding dat je vandaag voor jezelf deed. Eén is genoeg.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await saveCheckin({ date, activities: [...selected], note });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const s = r.data!.stats;
      setSuccess({ streak: s.current, longest: s.longest, milestone: isMilestone(s.current) && s.current > r.data!.previousStreak, created: r.data!.created });
    });
  }

  function remove() {
    if (!confirm("Check-in verwijderen?")) return;
    start(async () => {
      const r = await deleteCheckin(date);
      if (!r.ok) setError(r.error);
      else router.push("/");
    });
  }

  if (success) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-[24px] border border-ice/40 bg-card p-6 text-center shadow-[var(--shadow-glow)]"
      >
        {!reduce ? <Snowflakes /> : null}
        <motion.div
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
          className="glow-once mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ice/15 text-4xl"
        >
          <span aria-hidden>❄️</span>
        </motion.div>
        <h2 className="mt-5 text-xl font-bold">Another day. Another step forward. ❄️</h2>
        <p className="mt-1 text-sm text-muted">
          {success.created ? "Je check-in staat. Lekker bezig!" : "Je check-in is bijgewerkt."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-6">
          <div>
            <div className="text-4xl font-extrabold tabular-nums text-warm">
              <span aria-hidden>🔥 </span>
              {success.streak}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted">
              {success.streak === 1 ? "dag streak" : "dagen streak"}
            </div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <div className="text-4xl font-extrabold tabular-nums">{success.longest}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted">record</div>
          </div>
        </div>
        {success.milestone ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-5 rounded-2xl bg-gold/15 px-4 py-2 text-sm font-semibold text-gold"
          >
            🏅 Mijlpaal: {success.streak} dagen op rij. Dat is consistentie.
          </motion.p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/wall">
            <Button className="w-full">Deel een moment op de Wall</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="w-full">
              Terug naar home
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {dates.length > 1 ? (
        <div className="flex rounded-2xl bg-card p-1" role="tablist" aria-label="Datum">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={date === d}
              onClick={() => switchDate(d)}
              className={cn(
                "flex-1 rounded-xl py-2 text-sm font-medium transition",
                date === d ? "bg-card-2 text-text shadow" : "text-muted",
              )}
            >
              {d === today ? "Vandaag" : "Gisteren"}
              {existing[d] ? <Check className="ml-1 inline h-3.5 w-3.5 text-ice" aria-label="al ingecheckt" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-sm text-muted">
        {date === today ? "Vandaag" : "Gisteren"}, {formatDateNl(date)}.{" "}
        {current ? "Je kunt je check-in nog aanpassen." : "Eén activiteit is genoeg."}
      </p>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Activiteiten">
        {ACTIVITIES.map((a) => {
          const on = selected.has(a.key);
          return (
            <motion.button
              key={a.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(a.key)}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              className={cn(
                "relative flex min-h-[104px] flex-col items-start justify-between rounded-[18px] border p-4 text-left transition-colors",
                on ? "border-ice/70 bg-ice/10 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.5)]" : "border-border bg-card hover:bg-card-2",
              )}
            >
              <span className="text-3xl leading-none" aria-hidden>
                {a.emoji}
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{a.label}</span>
                <span className="block text-xs text-muted">{a.hint}</span>
              </span>
              <AnimatePresence>
                {on ? (
                  <motion.span
                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ice text-bg"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {showNote ? (
        <div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Vandaag lekker benen getraind!"
            aria-label="Bericht (optioneel)"
            autoFocus={!current?.note}
          />
          <p className="mt-1 text-right text-xs text-muted">{note.length}/200</p>
        </div>
      ) : (
        <button type="button" onClick={() => setShowNote(true)} className="text-sm text-ice underline-offset-4 hover:underline">
          + Voeg een kort bericht toe (optioneel)
        </button>
      )}

      <ErrorText>{error}</ErrorText>

      <Button size="lg" className="w-full" onClick={submit} loading={pending}>
        {current ? "Check-in bijwerken" : "Check-in afronden"}
      </Button>

      {current ? (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="mx-auto flex items-center gap-1.5 text-xs text-muted hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" /> Check-in verwijderen
        </button>
      ) : null}

      <p className="text-center text-xs text-muted">
        Huidige streak {stats.current} · Record {stats.longest} · Totaal {stats.total} {stats.total === 1 ? "dag" : "dagen"}
      </p>
    </div>
  );
}

function Snowflakes() {
  const flakes = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {flakes.map((i) => (
        <motion.span
          key={i}
          className="absolute text-ice/70"
          style={{ left: `${8 + i * 9}%`, fontSize: 10 + (i % 3) * 5 }}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 260, opacity: [0, 1, 1, 0], x: [0, i % 2 ? 10 : -10, 0] }}
          transition={{ duration: 3.2 + (i % 4) * 0.4, delay: i * 0.12, ease: "easeIn" }}
        >
          ❄
        </motion.span>
      ))}
    </div>
  );
}
