-- ---------------------------------------------------------------------------
-- 0031: BADI Wereld, fase 2. Together in the world.
--
-- 1. world_profiles.activity: the seat or spot you were on when you left
--    (e.g. 'zit-2', 'loopband-1'), so others see you sitting there in your
--    rest pose while you are offline. Null when you were standing.
-- 2. The live world channel 'wereld:<challenge id>' is private: only members
--    of that group may receive (select) and send (insert) presence and
--    broadcast messages on it. Positions and speech balloons are never stored.
-- ---------------------------------------------------------------------------

alter table public.world_profiles
  add column if not exists activity text check (activity is null or activity ~ '^[a-z0-9-]{1,40}$');

-- The group id from a world channel name, or null for any other topic.
create or replace function public.world_channel_challenge(p_topic text)
returns uuid
language sql
immutable
as $$
  select case
    when p_topic ~ '^wereld:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substring(p_topic from 8)::uuid
    else null
  end;
$$;

drop policy if exists "world channel: members receive" on realtime.messages;
create policy "world channel: members receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('presence', 'broadcast')
    and public.is_member(public.world_channel_challenge((select realtime.topic())))
  );

drop policy if exists "world channel: members send" on realtime.messages;
create policy "world channel: members send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('presence', 'broadcast')
    and public.is_member(public.world_channel_challenge((select realtime.topic())))
  );
