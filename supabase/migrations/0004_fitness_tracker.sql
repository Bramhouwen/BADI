-- BADI Fitness Tracker: workouts, exercises, plans and the check-in source link.
-- Additive only: no existing table is changed or removed.

-- ---------------------------------------------------------------------------
-- Exercise library (standard rows have no owner; custom rows belong to a member)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  muscle_group text not null check (muscle_group in ('legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'cardio', 'other')),
  is_custom boolean not null default false,
  owner_user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((is_custom and owner_user_id is not null) or (not is_custom and owner_user_id is null))
);

create index exercises_owner_idx on public.exercises (owner_user_id);

insert into public.exercises (name, muscle_group) values
  ('Squat', 'legs'), ('Leg Press', 'legs'), ('Lunges', 'legs'), ('Romanian Deadlift', 'legs'),
  ('Leg Extension', 'legs'), ('Leg Curl', 'legs'), ('Calf Raise', 'legs'),
  ('Bench Press', 'chest'), ('Incline Dumbbell Press', 'chest'), ('Chest Fly', 'chest'), ('Push-up', 'chest'),
  ('Lat Pulldown', 'back'), ('Seated Row', 'back'), ('Bent-over Row', 'back'), ('Pull-up', 'back'),
  ('Shoulder Press', 'shoulders'), ('Lateral Raise', 'shoulders'), ('Rear Delt Fly', 'shoulders'),
  ('Bicep Curl', 'arms'), ('Hammer Curl', 'arms'), ('Tricep Pushdown', 'arms'), ('Tricep Extension', 'arms'),
  ('Plank', 'core'), ('Crunch', 'core'), ('Leg Raise', 'core'), ('Russian Twist', 'core');

-- ---------------------------------------------------------------------------
-- Plans and templates
-- ---------------------------------------------------------------------------
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  goal text check (goal is null or char_length(goal) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_plans_user_idx on public.workout_plans (user_id);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  activity_type text not null default 'strength' check (activity_type in ('run', 'walk', 'cycle', 'strength', 'hiit', 'yoga', 'other')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index workout_templates_plan_idx on public.workout_templates (plan_id, sort_order);

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sort_order int not null default 0,
  target_sets int not null default 3 check (target_sets between 1 and 20),
  target_reps int check (target_reps is null or target_reps between 1 and 500),
  target_weight_kg numeric(6, 2) check (target_weight_kg is null or target_weight_kg between 0 and 1000)
);

create index template_exercises_template_idx on public.template_exercises (template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete set null,
  template_id uuid references public.workout_templates (id) on delete set null,
  activity_type text not null check (activity_type in ('run', 'walk', 'cycle', 'strength', 'hiit', 'yoga', 'other')),
  title text not null check (char_length(title) between 1 and 80),
  workout_date date not null,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds int check (duration_seconds is null or duration_seconds between 0 and 86400),
  distance_meters int check (distance_meters is null or distance_meters between 0 and 1000000),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_sessions_user_date_idx on public.workout_sessions (user_id, workout_date desc);
create index workout_sessions_user_status_idx on public.workout_sessions (user_id, status);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sort_order int not null default 0,
  notes text check (notes is null or char_length(notes) <= 300)
);

create index workout_exercises_session_idx on public.workout_exercises (session_id, sort_order);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number int not null check (set_number between 1 and 50),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 0 and 1000),
  repetitions int check (repetitions is null or repetitions between 0 and 1000),
  completed boolean not null default false
);

create index exercise_sets_we_idx on public.exercise_sets (workout_exercise_id, set_number);

-- ---------------------------------------------------------------------------
-- Check-in sources: why an activity counts on a day (manual tick or a workout)
-- ---------------------------------------------------------------------------
create table public.checkin_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  checkin_date date not null,
  activity text not null check (activity in ('moved', 'strength', 'nutrition', 'recovery', 'hydration', 'alcohol')),
  source text not null check (source in ('manual', 'workout')),
  workout_session_id uuid references public.workout_sessions (id) on delete cascade,
  source_key text generated always as (coalesce(workout_session_id::text, 'manual')) stored,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date, activity, source_key)
);

create index checkin_sources_user_date_idx on public.checkin_sources (user_id, checkin_date);

-- Backfill: every existing check-in was entered manually.
insert into public.checkin_sources (user_id, challenge_id, checkin_date, activity, source)
select c.user_id, c.challenge_id, c.checkin_date, a, 'manual'
from public.daily_checkins c
cross join lateral unnest(c.activities) as a
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create trigger workout_plans_touch before update on public.workout_plans for each row execute function public.touch_updated_at();
create trigger workout_sessions_touch before update on public.workout_sessions for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: everything is private to its owner
-- ---------------------------------------------------------------------------
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.checkin_sources enable row level security;

create policy "exercises: read standard and own" on public.exercises
  for select to authenticated using (owner_user_id is null or owner_user_id = auth.uid());
create policy "exercises: insert own custom" on public.exercises
  for insert to authenticated with check (is_custom and owner_user_id = auth.uid());
create policy "exercises: update own custom" on public.exercises
  for update to authenticated using (owner_user_id = auth.uid()) with check (is_custom and owner_user_id = auth.uid());
create policy "exercises: delete own custom" on public.exercises
  for delete to authenticated using (owner_user_id = auth.uid());

create policy "plans: own" on public.workout_plans
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "templates: own" on public.workout_templates
  for all to authenticated
  using (exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy "template exercises: own" on public.template_exercises
  for all to authenticated
  using (exists (select 1 from public.workout_templates t join public.workout_plans p on p.id = t.plan_id where t.id = template_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_templates t join public.workout_plans p on p.id = t.plan_id where t.id = template_id and p.user_id = auth.uid()));

create policy "sessions: own" on public.workout_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "workout exercises: own" on public.workout_exercises
  for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "sets: own" on public.exercise_sets
  for all to authenticated
  using (exists (select 1 from public.workout_exercises we join public.workout_sessions s on s.id = we.session_id where we.id = workout_exercise_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_exercises we join public.workout_sessions s on s.id = we.session_id where we.id = workout_exercise_id and s.user_id = auth.uid()));

create policy "checkin sources: own" on public.checkin_sources
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
