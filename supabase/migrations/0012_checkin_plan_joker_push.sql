-- ---------------------------------------------------------------------------
-- 0012: Clear daily check-in, week planning, jokers and push notifications
--
-- Daily habits: steps, hydration, nutrition (whole foods), protein, recovery
-- (sleep) and alcohol (none). Weekly trainings: run and strength, planned per
-- day. Water above the daily goal ticks hydration automatically (source
-- 'water'). The two alcohol exceptions become jokers that the squad sees.
-- Push subscriptions are stored per device; senders reach other members only
-- through push_targets(), which respects each member's settings.
-- ---------------------------------------------------------------------------

-- 1. Allowed check-in activities --------------------------------------------
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.daily_checkins'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%activities%'
  loop
    execute format('alter table public.daily_checkins drop constraint %I', r.conname);
  end loop;
  for r in
    select conname from pg_constraint
    where conrelid = 'public.checkin_sources'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%activity%' or pg_get_constraintdef(oid) ilike '%source%')
  loop
    execute format('alter table public.checkin_sources drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table public.daily_checkins
  add constraint daily_checkins_activities_count check (cardinality(activities) between 1 and 9),
  add constraint daily_checkins_activities_known check (
    activities <@ array['steps', 'hydration', 'nutrition', 'protein', 'recovery', 'alcohol', 'run', 'strength', 'moved']::text[]
  );

alter table public.checkin_sources
  add constraint checkin_sources_activity_known check (
    activity in ('steps', 'hydration', 'nutrition', 'protein', 'recovery', 'alcohol', 'run', 'strength', 'moved')
  ),
  add constraint checkin_sources_source_known check (source in ('manual', 'workout', 'water'));

-- The source key now includes the source, so a manual and an automatic water tick can coexist.
alter table public.checkin_sources drop column source_key cascade;
alter table public.checkin_sources add column source_key text generated always as (coalesce(workout_session_id::text, source)) stored;
alter table public.checkin_sources add constraint checkin_sources_unique unique (user_id, checkin_date, activity, source_key);

-- 2. Week planning ------------------------------------------------------------
create table public.planned_trainings (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  kind text not null check (kind in ('run', 'strength')),
  created_at timestamptz not null default now(),
  unique (user_id, plan_date, kind)
);

alter table public.planned_trainings enable row level security;

create policy "planned trainings: own" on public.planned_trainings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));

-- 3. Jokers (the two alcohol moments), visible to the squad --------------------
alter table public.alcohol_exceptions add column chat_message_id uuid references public.squad_messages (id) on delete set null;

create policy "alcohol: members read" on public.alcohol_exceptions
  for select to authenticated using (public.is_member(challenge_id));

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('compliment', 'reaction', 'post', 'recipe', 'mention', 'joker'));

create or replace function public.notify_members_on_joker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, challenge_id, type, actor_id, ref_id)
  select m.user_id, new.challenge_id, 'joker', new.user_id, new.id
  from public.memberships m
  where m.challenge_id = new.challenge_id and m.user_id <> new.user_id;
  return new;
end;
$$;

create trigger alcohol_exceptions_notify
  after insert on public.alcohol_exceptions
  for each row execute function public.notify_members_on_joker();

-- 4. Push notifications ---------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push subscriptions: own" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));

create table public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  chat boolean not null default true,
  mentions boolean not null default true,
  recipes boolean not null default true,
  jokers boolean not null default true,
  compliments boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

create policy "notification settings: own" on public.notification_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Devices of other squad members that want this kind of notification.
-- p_only limits the result to one member (for example the receiver of a compliment).
create or replace function public.push_targets(p_kind text, p_only uuid default null)
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.memberships m on m.user_id = s.user_id
  left join public.notification_settings n on n.user_id = s.user_id
  where m.challenge_id = public.current_challenge_id()
    and s.user_id <> auth.uid()
    and (p_only is null or s.user_id = p_only)
    and case p_kind
      when 'chat' then coalesce(n.chat, true)
      when 'mentions' then coalesce(n.mentions, true)
      when 'recipes' then coalesce(n.recipes, true)
      when 'jokers' then coalesce(n.jokers, true)
      when 'compliments' then coalesce(n.compliments, true)
      else false
    end;
$$;

-- Removes a device whose subscription expired (the push service answered 404 or 410).
create or replace function public.forget_push_endpoint(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions s
  using public.memberships m
  where s.endpoint = p_endpoint and m.user_id = s.user_id and m.challenge_id = public.current_challenge_id();
$$;

revoke all on function public.push_targets(text, uuid) from public;
grant execute on function public.push_targets(text, uuid) to authenticated;
revoke all on function public.forget_push_endpoint(text) from public;
grant execute on function public.forget_push_endpoint(text) to authenticated;
