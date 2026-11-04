-- ---------------------------------------------------------------------------
-- 0021: steps as a weekly goal
--
-- Members type in their step count per day (from the Health app on their
-- phone). The app scores the week: 1 point per 10,000 steps, at most 7, so a
-- quiet day can be made up later in the week. Squad members see the steps of
-- members who share their check-ins, like the check-ins themselves.
-- ---------------------------------------------------------------------------

create table public.step_logs (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  steps int not null check (steps between 0 and 100000),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index step_logs_challenge_day_idx on public.step_logs (challenge_id, log_date);

alter table public.step_logs enable row level security;

create policy "steps: members read" on public.step_logs
  for select to authenticated using (
    user_id = auth.uid()
    or (public.is_member(challenge_id) and public.shares_stat(user_id, 'checkins'))
  );
create policy "steps: insert own" on public.step_logs
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "steps: update own" on public.step_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "steps: delete own" on public.step_logs
  for delete to authenticated using (user_id = auth.uid());

create trigger step_logs_touch before update on public.step_logs for each row execute function public.touch_updated_at();
