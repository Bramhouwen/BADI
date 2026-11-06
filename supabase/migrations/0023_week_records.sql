-- ---------------------------------------------------------------------------
-- 0023: personal records for the weekly bonus
--
-- Workouts are private per member (RLS), but the bonus of +5 per new personal
-- record counts in everyone's week score. This function returns only the
-- user and date of each new record since p_from, for members of a challenge
-- the caller belongs to; no weights or exercises.
--
-- A record: an exercise in a completed session that beats the best of all
-- earlier sessions of the same member. Timed exercises compare the longest
-- hold, weighted ones the heaviest set, bodyweight ones the most repetitions.
-- The first session of an exercise is the baseline. Same rules as
-- personalRecords in src/lib/checkin-plan.ts.
-- ---------------------------------------------------------------------------

create or replace function public.week_records(p_challenge uuid, p_from date)
returns table (user_id uuid, record_date date)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select
      s.user_id,
      s.id as session_id,
      s.workout_date,
      s.created_at,
      we.exercise_id,
      e.measure,
      max(x.weight_kg) filter (where x.weight_kg > 0) as kg,
      max(x.repetitions) filter (where coalesce(x.weight_kg, 0) = 0) as reps,
      max(x.duration_seconds) as secs
    from public.workout_sessions s
    join public.workout_exercises we on we.session_id = s.id
    join public.exercises e on e.id = we.exercise_id
    join public.exercise_sets x on x.workout_exercise_id = we.id and x.completed
    where s.status = 'completed'
      and public.is_member(p_challenge)
      and s.user_id in (select m.user_id from public.memberships m where m.challenge_id = p_challenge)
    group by s.user_id, s.id, s.workout_date, s.created_at, we.exercise_id, e.measure
  ),
  ranked as (
    select
      b.*,
      max(b.kg) over w as prev_kg,
      max(b.reps) over w as prev_reps,
      max(b.secs) over w as prev_secs
    from best b
    window w as (
      partition by b.user_id, b.exercise_id
      order by b.workout_date, b.created_at
      rows between unbounded preceding and 1 preceding
    )
  )
  select r.user_id, r.workout_date as record_date
  from ranked r
  where r.workout_date >= p_from
    and coalesce(
      case
        when r.measure = 'time' then r.secs > r.prev_secs
        when r.kg is not null then r.kg > r.prev_kg
        else r.reps > r.prev_reps
      end,
      false
    );
$$;

revoke all on function public.week_records(uuid, date) from public;
grant execute on function public.week_records(uuid, date) to authenticated;
