-- ---------------------------------------------------------------------------
-- 0015: Own habits on the check-in
--
-- custom_habits: up to six personal habits per member (name plus optional
-- emoji), owner only. They do not count toward the daily score or streak.
-- custom_habit_logs: one row per habit per ticked day, owner only.
-- stat_sharing.share_habits: off by default. Squad members only read habits
-- through member_habits(), which checks this switch itself.
-- ---------------------------------------------------------------------------

create table public.custom_habits (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  emoji text check (emoji is null or char_length(emoji) between 1 and 8),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index custom_habits_user_idx on public.custom_habits (user_id, sort_order);

alter table public.custom_habits enable row level security;

create policy "custom habits: own" on public.custom_habits
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));

create table public.custom_habit_logs (
  habit_id uuid not null references public.custom_habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, log_date)
);

create index custom_habit_logs_user_idx on public.custom_habit_logs (user_id, log_date);

alter table public.custom_habit_logs enable row level security;

create policy "custom habit logs: own" on public.custom_habit_logs
  for all to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.custom_habits h where h.id = habit_id and h.user_id = auth.uid())
  );

alter table public.stat_sharing add column share_habits boolean not null default false;

create or replace function public.shares_stat(p_user uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case p_key
       when 'workout_counts' then share_workout_counts
       when 'minutes_distance' then share_minutes_distance
       when 'active_days' then share_active_days
       when 'checkins' then share_checkins
       when 'records' then share_records
       when 'recent_workouts' then share_recent_workouts
       when 'habits' then share_habits
       else false
     end
     from public.stat_sharing where user_id = p_user),
    p_key = 'checkins'
  );
$$;

-- Habits of one member with the ticked days in a range. Yourself always;
-- a squad member only while that member shares habits.
create or replace function public.member_habits(p_user uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shared boolean;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'RANGE_TOO_LARGE' using errcode = '22023';
  end if;

  v_shared := p_user = auth.uid() or (
    exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.challenge_id = mine.challenge_id
      where mine.user_id = auth.uid() and theirs.user_id = p_user
    )
    and public.shares_stat(p_user, 'habits')
  );

  if not v_shared then
    return jsonb_build_object('shared', false, 'habits', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'shared', true,
    'habits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'emoji', h.emoji,
        'dates', coalesce((
          select jsonb_agg(l.log_date order by l.log_date)
          from public.custom_habit_logs l
          where l.habit_id = h.id and l.log_date between p_from and p_to
        ), '[]'::jsonb)
      ) order by h.sort_order, h.created_at)
      from public.custom_habits h
      where h.user_id = p_user
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.member_habits(uuid, date, date) from public, anon;
grant execute on function public.member_habits(uuid, date, date) to authenticated;
