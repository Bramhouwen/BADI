-- ---------------------------------------------------------------------------
-- 0018: Warming-up and mobility exercises
--
-- A new muscle group "mobility" and ten standard exercises for warming up and
-- mobility. The app shows an animated demo for these and for all other
-- standard exercises.
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.exercises'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%muscle_group%'
  loop
    execute format('alter table public.exercises drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table public.exercises add constraint exercises_muscle_group_known
  check (muscle_group in ('legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'mobility', 'cardio', 'other'));

insert into public.exercises (name, muscle_group)
select v.name, 'mobility'
from (values
  ('Jumping Jacks'), ('Arm Circles'), ('High Knees'), ('Leg Swings'), ('Glute Bridge'),
  ('Cat-Cow'), ('Bird Dog'), ('Downward Dog'), ('Hip Flexor Stretch'), ('Inchworm')
) as v(name)
where not exists (select 1 from public.exercises e where e.is_custom = false and lower(e.name) = lower(v.name));
