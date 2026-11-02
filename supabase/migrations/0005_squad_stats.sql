-- ---------------------------------------------------------------------------
-- 0005: Squad statistics with per-user sharing settings
--
-- Fitness and check-in data are personal. A member decides per category
-- whether squad members may see it. Enforcement happens in the database:
--  * stat_sharing holds the switches (owner-only RLS).
--  * squad_member_stats() is the only way squad members read another
--    member's fitness data; it returns aggregated, already-filtered JSON.
--  * daily_checkins RLS now also checks the check-in switch, so the Squad
--    overview, timeline and Wrapped hide check-ins of members who opt out.
--
-- Defaults: fitness categories are private until shared. Check-ins stay
-- visible by default, as they already were in the squad design, and can
-- be switched off at any time.
-- ---------------------------------------------------------------------------

create table public.stat_sharing (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  share_workout_counts boolean not null default false,
  share_minutes_distance boolean not null default false,
  share_active_days boolean not null default false,
  share_checkins boolean not null default true,
  share_records boolean not null default false,
  share_recent_workouts boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.stat_sharing enable row level security;

create policy "stat sharing: own" on public.stat_sharing
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger stat_sharing_touch
  before update on public.stat_sharing
  for each row execute function public.touch_updated_at();

-- Does p_user share a given category? Missing row = defaults.
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
       else false
     end
     from public.stat_sharing where user_id = p_user),
    p_key = 'checkins'
  );
$$;

-- Check-ins: own rows always, squad members only while the owner shares them.
drop policy if exists "checkins: members read" on public.daily_checkins;
create policy "checkins: members read" on public.daily_checkins
  for select to authenticated using (
    user_id = auth.uid()
    or (public.is_member(challenge_id) and public.shares_stat(user_id, 'checkins'))
  );

-- ---------------------------------------------------------------------------
-- Aggregated statistics of one squad member, filtered by their settings.
-- The caller must share a challenge with p_user. For the caller's own
-- profile everything is returned. Never returns notes, titles or sets.
-- ---------------------------------------------------------------------------
create or replace function public.squad_member_stats(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_self boolean;
  v_counts boolean;
  v_minutes boolean;
  v_active boolean;
  v_checkins boolean;
  v_records boolean;
  v_recent boolean;
  v_sessions jsonb := '[]'::jsonb;
  v_dates jsonb := '[]'::jsonb;
  v_checkin_dates jsonb := '[]'::jsonb;
  v_records_json jsonb := null;
  v_recent_json jsonb := '[]'::jsonb;
begin
  if v_me is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  v_self := (p_user = v_me);
  if not v_self and not public.shares_challenge_with(p_user) then
    raise exception 'NOT_A_MEMBER';
  end if;

  v_counts := v_self or public.shares_stat(p_user, 'workout_counts');
  v_minutes := v_self or public.shares_stat(p_user, 'minutes_distance');
  v_active := v_self or public.shares_stat(p_user, 'active_days');
  v_checkins := v_self or public.shares_stat(p_user, 'checkins');
  v_records := v_self or public.shares_stat(p_user, 'records');
  v_recent := v_self or public.shares_stat(p_user, 'recent_workouts');

  if v_counts then
    select coalesce(jsonb_agg(jsonb_build_object(
      'activity_type', activity_type,
      'workout_date', workout_date,
      'duration_seconds', case when v_minutes then duration_seconds end,
      'distance_meters', case when v_minutes then distance_meters end
    ) order by workout_date desc), '[]'::jsonb)
    into v_sessions
    from public.workout_sessions
    where user_id = p_user and status = 'completed';
  elsif v_active then
    select coalesce(jsonb_agg(distinct workout_date), '[]'::jsonb)
    into v_dates
    from public.workout_sessions
    where user_id = p_user and status = 'completed';
  end if;

  if v_checkins then
    select coalesce(jsonb_agg(checkin_date order by checkin_date), '[]'::jsonb)
    into v_checkin_dates
    from public.daily_checkins
    where user_id = p_user;
  end if;

  if v_records then
    v_records_json := jsonb_build_object(
      'longest_run_meters', (
        select max(distance_meters) from public.workout_sessions
        where user_id = p_user and status = 'completed' and activity_type = 'run'
      ),
      'fastest_5k_seconds', (
        select min(duration_seconds) from public.workout_sessions
        where user_id = p_user and status = 'completed' and activity_type = 'run'
          and distance_meters between 5000 and 5500 and duration_seconds > 0
      ),
      'strength', (
        select coalesce(jsonb_agg(jsonb_build_object('exercise', t.name, 'max_weight_kg', t.mx) order by t.mx desc), '[]'::jsonb)
        from (
          select e.name, max(es.weight_kg) as mx
          from public.exercise_sets es
          join public.workout_exercises we on we.id = es.workout_exercise_id
          join public.workout_sessions ws on ws.id = we.session_id
          join public.exercises e on e.id = we.exercise_id
          where ws.user_id = p_user and ws.status = 'completed' and es.completed and es.weight_kg > 0
          group by e.name
          order by max(es.weight_kg) desc
          limit 6
        ) t
      )
    );
  end if;

  if v_recent then
    select coalesce(jsonb_agg(jsonb_build_object(
      'activity_type', activity_type,
      'workout_date', workout_date,
      'duration_seconds', case when v_minutes then duration_seconds end,
      'distance_meters', case when v_minutes then distance_meters end
    ) order by workout_date desc, completed_at desc), '[]'::jsonb)
    into v_recent_json
    from (
      select activity_type, workout_date, duration_seconds, distance_meters, completed_at
      from public.workout_sessions
      where user_id = p_user and status = 'completed'
      order by workout_date desc, completed_at desc
      limit 10
    ) r;
  end if;

  return jsonb_build_object(
    'user_id', p_user,
    'sharing', jsonb_build_object(
      'workout_counts', v_counts,
      'minutes_distance', v_minutes,
      'active_days', v_active,
      'checkins', v_checkins,
      'records', v_records,
      'recent_workouts', v_recent
    ),
    'sessions', v_sessions,
    'workout_dates', v_dates,
    'checkin_dates', v_checkin_dates,
    'records', v_records_json,
    'recent', v_recent_json
  );
end;
$$;

revoke all on function public.squad_member_stats(uuid) from public;
grant execute on function public.squad_member_stats(uuid) to authenticated;
revoke all on function public.shares_stat(uuid, text) from public;
grant execute on function public.shares_stat(uuid, text) to authenticated;
