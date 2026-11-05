-- ---------------------------------------------------------------------------
-- 0022: share everything with the squad by default, plus water
--
-- The squad decided that all statistics are visible to each other. Every
-- sharing switch now defaults to on and is switched on for all members; a
-- member can still turn one off on their profile. New category "water":
-- squad members can read each other's water entries. Private chats (direct
-- messages and conversations with Baddy) stay private and are not touched.
-- ---------------------------------------------------------------------------

alter table public.stat_sharing add column share_water boolean not null default true;

alter table public.stat_sharing
  alter column share_workout_counts set default true,
  alter column share_minutes_distance set default true,
  alter column share_active_days set default true,
  alter column share_checkins set default true,
  alter column share_records set default true,
  alter column share_recent_workouts set default true,
  alter column share_habits set default true;

update public.stat_sharing set
  share_workout_counts = true,
  share_minutes_distance = true,
  share_active_days = true,
  share_checkins = true,
  share_records = true,
  share_recent_workouts = true,
  share_habits = true,
  share_water = true;

-- Missing row = everything shared.
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
       when 'water' then share_water
       else false
     end
     from public.stat_sharing where user_id = p_user),
    p_key in ('workout_counts', 'minutes_distance', 'active_days', 'checkins', 'records', 'recent_workouts', 'habits', 'water')
  );
$$;

create policy "water: members read" on public.water_entries
  for select to authenticated using (public.is_member(challenge_id) and public.shares_stat(user_id, 'water'));
