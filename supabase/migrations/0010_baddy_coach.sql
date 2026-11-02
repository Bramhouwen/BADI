-- ---------------------------------------------------------------------------
-- 0010: Baddy de Coach
--
-- Each member has a private conversation with Baddy (coach_messages, owner
-- only). Recipes, workout plans and squad chat messages that Baddy writes
-- are stored under the member who asked, marked with by_coach / is_coach so
-- the app shows Baddy as the author.
-- ---------------------------------------------------------------------------

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null check (char_length(body) <= 12000),
  refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index coach_messages_user_idx on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;

create policy "coach messages: own read" on public.coach_messages
  for select to authenticated using (user_id = auth.uid());
create policy "coach messages: own insert" on public.coach_messages
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "coach messages: own delete" on public.coach_messages
  for delete to authenticated using (user_id = auth.uid());

alter table public.recipes add column by_coach boolean not null default false;
alter table public.workout_plans add column by_coach boolean not null default false;
alter table public.squad_messages add column is_coach boolean not null default false;
