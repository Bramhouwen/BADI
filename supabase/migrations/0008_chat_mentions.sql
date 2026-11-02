-- ---------------------------------------------------------------------------
-- 0008: @-mentions in the squad chat
--
-- A message stores the ids of the members it addresses. A trigger turns
-- each mention into a notification for that member.
-- ---------------------------------------------------------------------------

alter table public.squad_messages
  add column mentions uuid[] not null default '{}';

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('compliment', 'reaction', 'post', 'recipe', 'mention'));

-- Membership check for an arbitrary user (the existing is_member checks the caller).
create or replace function public.is_member_of(p_user uuid, p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.memberships where user_id = p_user and challenge_id = p_challenge);
$$;

create or replace function public.notify_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  foreach v_uid in array new.mentions loop
    if v_uid <> new.user_id and public.is_member_of(v_uid, new.challenge_id) then
      insert into public.notifications (user_id, challenge_id, type, actor_id, ref_id)
      values (v_uid, new.challenge_id, 'mention', new.user_id, new.id);
    end if;
  end loop;
  return new;
end;
$$;

create trigger squad_messages_notify_mentions
  after insert on public.squad_messages
  for each row execute function public.notify_on_mention();
