-- ---------------------------------------------------------------------------
-- 0026: Super Badi of the week
--
-- The Super Badi is whoever did best in the week that just ended (most week
-- points including bonus; then steps; then check-in days). The result is
-- stored once per week, so the crown stays put all week, and Baddy
-- congratulates the winner in the squad chat at that moment. The first member
-- who opens the app after Monday 00:00 settles it; a second call does nothing.
-- ---------------------------------------------------------------------------

create table public.super_badi_awards (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  week_start date not null,
  -- Empty when nobody scored that week.
  user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (challenge_id, week_start)
);

alter table public.super_badi_awards enable row level security;

create policy "super badi: members read" on public.super_badi_awards
  for select to authenticated using (public.is_member(challenge_id));

-- Stores the award for a finished week and posts Baddy's message, once.
-- Returns true when this call stored it, false when it was already there.
create or replace function public.award_super_badi(p_challenge uuid, p_week date, p_users uuid[], p_body text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_member(p_challenge) then
    raise exception 'NOT_MEMBER';
  end if;
  if p_week + 7 > public.wheel_week_start(p_challenge) then
    raise exception 'WEEK_NOT_FINISHED';
  end if;
  if exists (select 1 from unnest(p_users) u where not exists (select 1 from public.memberships m where m.challenge_id = p_challenge and m.user_id = u)) then
    raise exception 'NOT_MEMBER';
  end if;

  insert into public.super_badi_awards (challenge_id, week_start, user_ids)
  values (p_challenge, p_week, coalesce(p_users, '{}'))
  on conflict do nothing;
  if not found then
    return false;
  end if;

  if cardinality(p_users) > 0 and coalesce(btrim(p_body), '') <> '' then
    insert into public.squad_messages (challenge_id, user_id, body, mentions, is_coach)
    values (p_challenge, auth.uid(), left(p_body, 1000), '{}', true);
  end if;
  return true;
end;
$$;

revoke all on function public.award_super_badi(uuid, date, uuid[], text) from public, anon;
grant execute on function public.award_super_badi(uuid, date, uuid[], text) to authenticated;
