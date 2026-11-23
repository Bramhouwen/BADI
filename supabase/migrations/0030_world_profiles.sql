-- ---------------------------------------------------------------------------
-- 0030: BADI Wereld, fase 0. One world profile per member: which character
-- they are and where they were last (scene and position on its walking grid).
-- Everyone in the group reads all profiles; you only write your own row.
-- ---------------------------------------------------------------------------

create table if not exists public.world_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  -- Folder name in public/wereld/poppetjes, e.g. 'anne'. Null while no character exists.
  sprite text check (sprite is null or sprite ~ '^[a-z0-9-]{1,40}$'),
  scene text not null default 'buiten' check (scene ~ '^[a-z0-9-]{1,40}$'),
  x real,
  y real,
  updated_at timestamptz not null default now()
);

create index if not exists world_profiles_challenge_idx on public.world_profiles (challenge_id);

alter table public.world_profiles enable row level security;

drop policy if exists "world profiles: group reads" on public.world_profiles;
create policy "world profiles: group reads" on public.world_profiles
  for select to authenticated using (public.is_member(challenge_id));

drop policy if exists "world profiles: insert own" on public.world_profiles;
create policy "world profiles: insert own" on public.world_profiles
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));

drop policy if exists "world profiles: update own" on public.world_profiles;
create policy "world profiles: update own" on public.world_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));
