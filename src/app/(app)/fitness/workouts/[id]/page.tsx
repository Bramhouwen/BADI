import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireContext } from "@/lib/data";
import { activityMeta, muscleLabel, targetLabel, templateSummary } from "@/lib/fitness";
import { loadTemplate } from "@/lib/fitness/data";
import { coverFor } from "@/lib/exercise-video";
import { Page } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { ExerciseVideo } from "@/components/fitness/exercise-video";
import { StartChoice } from "@/components/fitness/session-actions";
import { startFromTemplate } from "@/app/actions/fitness";
import { WorkoutExercises } from "./workout-exercises";

export const metadata = { title: "Workout" };

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="glass flex-1 rounded-[16px] px-3 py-2.5 text-center">
      <p className="font-sans text-[19px] font-semibold leading-none tabular-nums text-text">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const found = await loadTemplate(ctx, id);
  if (!found) notFound();
  const { plan, template } = found;
  const cover = coverFor(template.exercises.map((e) => e.name));
  const sum = templateSummary(template.exercises);
  const meta = activityMeta(template.activity_type);
  const strength = template.activity_type === "strength";

  return (
    <Page className="space-y-5">
      <section className="relative -mx-5 overflow-hidden bg-[#6a3b2f] sm:mx-0 sm:rounded-[26px]" aria-label={template.name}>
        {cover ? <ExerciseVideo media={cover} label={`Uitvoering van ${cover.name}`} className="aspect-square w-full" /> : <div className="aspect-[2/1] w-full" />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#3b2019]/90 via-[#3b2019]/10 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <Link href="/fitness/plans" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur" aria-label="Terug">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </Link>
          <Link href={`/fitness/plans/${plan.id}`} className="flex h-10 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-ink shadow-sm backdrop-blur">
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.7} />
            <span className="text-[12.5px] font-medium">Bewerken</span>
          </Link>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-paper/75">{plan.name}</p>
          <h1 className="mt-1 font-display text-[30px] leading-[1.08] text-paper">{template.name}</h1>
          {cover ? <p className="mt-1 text-[12px] text-paper/75">In beeld: {cover.name}</p> : null}
        </div>
      </section>

      {strength ? (
        <div className="flex gap-2">
          <Fact value={String(sum.exercises)} label={sum.exercises === 1 ? "oefening" : "oefeningen"} />
          <Fact value={String(sum.sets)} label="sets" />
          <Fact value={sum.minutes > 0 ? `± ${sum.minutes}` : "–"} label="minuten" />
        </div>
      ) : (
        <p className="text-[13px] text-muted">{meta.label}</p>
      )}

      <StartChoice size="lg" start={startFromTemplate.bind(null, template.id, false)} after={startFromTemplate.bind(null, template.id, true)} />

      {strength ? (
        <section>
          <SectionTitle>Oefeningen</SectionTitle>
          {template.exercises.length > 0 ? (
            <WorkoutExercises items={template.exercises.map((e) => ({ id: e.id, name: e.name, muscle: muscleLabel(e.muscle_group), target: targetLabel(e) }))} />
          ) : (
            <p className="text-[13px] text-muted">
              Nog geen oefeningen.{" "}
              <Link href={`/fitness/plans/${plan.id}`} className="font-medium text-ink underline underline-offset-2">
                Voeg ze toe in het schema
              </Link>
              .
            </p>
          )}
        </section>
      ) : null}
    </Page>
  );
}

export default function WorkoutTemplatePage({ params }: PageProps<"/fitness/workouts/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
