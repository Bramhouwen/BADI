-- ---------------------------------------------------------------------------
-- 0013: Own water bottles and Baddy's morning and evening push
--
-- water_bottles: bottles a member saves with an exact size (for example a
-- 870 ml bottle), owner only.
-- notification_settings.coach: members can turn Baddy's daily pushes off.
-- coach_push_claim(): called by the scheduled job with a token from Vault;
-- returns the members to message for a slot and date, and records them so
-- nobody gets the same push twice.
-- ---------------------------------------------------------------------------

create table public.water_bottles (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  amount_ml int not null check (amount_ml between 1 and 3000),
  created_at timestamptz not null default now()
);

create index water_bottles_user_idx on public.water_bottles (user_id, created_at);

alter table public.water_bottles enable row level security;

create policy "water bottles: own" on public.water_bottles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));

alter table public.notification_settings add column coach boolean not null default true;

create table public.coach_push_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null check (slot in ('morning', 'evening')),
  push_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, slot, push_date)
);

-- Only the security definer functions below touch this table.
alter table public.coach_push_log enable row level security;

create or replace function public.coach_cron_token_ok(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'badi_coach_cron' limit 1;
  return v_secret is not null and p_token is not null and p_token = v_secret;
end;
$$;

revoke all on function public.coach_cron_token_ok(text) from public, anon, authenticated;

create or replace function public.coach_push_claim(p_token text, p_slot text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.coach_cron_token_ok(p_token) then
    raise exception 'UNAUTHORIZED' using errcode = 'insufficient_privilege';
  end if;
  if p_slot not in ('morning', 'evening') then
    raise exception 'BAD_SLOT';
  end if;

  with candidates as (
    select m.user_id, m.challenge_id, c.start_date, c.end_date, p.display_name
    from public.memberships m
    join public.challenges c on c.id = m.challenge_id
    join public.profiles p on p.id = m.user_id
    left join public.notification_settings n on n.user_id = m.user_id
    where coalesce(n.coach, true)
      and p_date between c.start_date and c.end_date
      and exists (select 1 from public.push_subscriptions s where s.user_id = m.user_id)
  ),
  claimed as (
    insert into public.coach_push_log (user_id, slot, push_date)
    select user_id, p_slot, p_date from candidates
    on conflict do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', c.user_id,
    'name', c.display_name,
    'start_date', c.start_date,
    'end_date', c.end_date,
    'checkin_dates', coalesce((
      select jsonb_agg(d.checkin_date order by d.checkin_date)
      from public.daily_checkins d
      where d.user_id = c.user_id and d.challenge_id = c.challenge_id and d.checkin_date <= p_date
    ), '[]'::jsonb),
    'today_activities', coalesce((
      select to_jsonb(d.activities) from public.daily_checkins d
      where d.user_id = c.user_id and d.challenge_id = c.challenge_id and d.checkin_date = p_date
    ), '[]'::jsonb),
    'joker_today', exists (select 1 from public.alcohol_exceptions a where a.user_id = c.user_id and a.exception_date = p_date),
    'planned_today', coalesce((select jsonb_agg(t.kind) from public.planned_trainings t where t.user_id = c.user_id and t.plan_date = p_date), '[]'::jsonb),
    'subscriptions', (
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscriptions s where s.user_id = c.user_id
    )
  )), '[]'::jsonb)
  into v_result
  from candidates c
  join claimed cl on cl.user_id = c.user_id;

  return v_result;
end;
$$;

create or replace function public.coach_forget_endpoint(p_token text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.coach_cron_token_ok(p_token) then
    raise exception 'UNAUTHORIZED' using errcode = 'insufficient_privilege';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function public.coach_push_claim(text, text, date) from public;
grant execute on function public.coach_push_claim(text, text, date) to anon, authenticated;
revoke all on function public.coach_forget_endpoint(text, text) from public;
grant execute on function public.coach_forget_endpoint(text, text) to anon, authenticated;
