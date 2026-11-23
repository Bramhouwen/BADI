-- ---------------------------------------------------------------------------
-- 0029: squad characters are released per member by the admin. A row here
-- means the character with this name (lower-case first name) is live: its
-- member sees it in the app and gets an introduction once.
-- ---------------------------------------------------------------------------

create table if not exists public.sprite_releases (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  sprite text not null check (sprite ~ '^[a-z0-9-]{1,40}$'),
  released_by uuid references public.profiles (id) on delete set null default auth.uid(),
  released_at timestamptz not null default now(),
  primary key (challenge_id, sprite)
);

alter table public.sprite_releases enable row level security;

drop policy if exists "sprite releases: members read" on public.sprite_releases;
create policy "sprite releases: members read" on public.sprite_releases
  for select to authenticated using (public.is_member(challenge_id));

drop policy if exists "sprite releases: admin insert" on public.sprite_releases;
create policy "sprite releases: admin insert" on public.sprite_releases
  for insert to authenticated with check (public.is_admin(challenge_id));

drop policy if exists "sprite releases: admin delete" on public.sprite_releases;
create policy "sprite releases: admin delete" on public.sprite_releases
  for delete to authenticated using (public.is_admin(challenge_id));
