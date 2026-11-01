-- Daily water tracker: small entries per member, summed per day in the app.
create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  amount_ml int not null check (amount_ml between 1 and 3000),
  created_at timestamptz not null default now()
);

create index water_entries_user_day_idx on public.water_entries (user_id, log_date);

alter table public.water_entries enable row level security;

-- Water intake is personal: only the member sees and edits their own entries.
create policy "water: read own" on public.water_entries
  for select to authenticated using (user_id = auth.uid());
create policy "water: insert own" on public.water_entries
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "water: delete own" on public.water_entries
  for delete to authenticated using (user_id = auth.uid());
