-- ---------------------------------------------------------------------------
-- 0011: Baddy remembers and learns from feedback
--
-- coach_memories: short facts per member (preferences, injuries, goals) that
-- Baddy saves or the member adds; only the member can see or delete them.
-- coach_messages.feedback: thumbs up (1) or down (-1) on Baddy's answers.
-- ---------------------------------------------------------------------------

create table public.coach_memories (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 200),
  source text not null default 'coach' check (source in ('coach', 'member')),
  created_at timestamptz not null default now()
);

create index coach_memories_user_idx on public.coach_memories (user_id, created_at);

alter table public.coach_memories enable row level security;

create policy "coach memories: own read" on public.coach_memories
  for select to authenticated using (user_id = auth.uid());
create policy "coach memories: own insert" on public.coach_memories
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "coach memories: own delete" on public.coach_memories
  for delete to authenticated using (user_id = auth.uid());

alter table public.coach_messages
  add column feedback smallint check (feedback is null or feedback in (-1, 1));

create policy "coach messages: own update" on public.coach_messages
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
