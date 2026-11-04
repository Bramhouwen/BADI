-- ---------------------------------------------------------------------------
-- 0020: exercises measured in time (plank and other holds)
--
-- exercises.measure: 'reps' (weight × repetitions, the default) or 'time'
-- (how long you hold it). Sets of a timed exercise store duration_seconds,
-- workout templates store target_seconds. Plank, Downward Dog and Hip Flexor
-- Stretch become timed; custom exercises choose for themselves.
-- ---------------------------------------------------------------------------

alter table public.exercises add column measure text not null default 'reps' check (measure in ('reps', 'time'));

update public.exercises set measure = 'time'
where is_custom = false and lower(name) in ('plank', 'downward dog', 'hip flexor stretch');

alter table public.exercise_sets add column duration_seconds int
  check (duration_seconds is null or duration_seconds between 0 and 3600);

alter table public.template_exercises add column target_seconds int
  check (target_seconds is null or target_seconds between 1 and 3600);
