-- ---------------------------------------------------------------------------
-- 0016: Private messages, reactions and read ticks
--
-- squad_messages.recipient_id: null for the squad group chat, a member id for
-- a private message. Only the sender and the recipient can read a private
-- message; group messages stay visible to the whole squad.
-- direct_reads: how far each member has read a private conversation; the
-- other person may read it too, for the "gelezen" ticks.
-- message_reactions: emoji under a message, visible to whoever can see the
-- message.
-- notification_settings.direct: push for private messages, on by default.
-- ---------------------------------------------------------------------------

alter table public.squad_messages add column recipient_id uuid references public.profiles (id) on delete cascade;
alter table public.squad_messages add constraint squad_messages_not_to_self check (recipient_id is null or recipient_id <> user_id);

create index squad_messages_direct_idx on public.squad_messages (challenge_id, recipient_id, user_id, created_at desc) where recipient_id is not null;

-- public.is_member_of(p_user, p_challenge) exists since 0008 and is reused here.

drop policy if exists "squad messages: members read" on public.squad_messages;
create policy "squad messages: members read" on public.squad_messages
  for select to authenticated using (
    public.is_member(challenge_id)
    and (recipient_id is null or user_id = auth.uid() or recipient_id = auth.uid())
  );

drop policy if exists "squad messages: insert own" on public.squad_messages;
create policy "squad messages: insert own" on public.squad_messages
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_member(challenge_id)
    and (recipient_id is null or (recipient_id <> auth.uid() and public.is_member_of(recipient_id, challenge_id)))
  );

-- Read state of private conversations ------------------------------------------
create table public.direct_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  peer_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, peer_id)
);

alter table public.direct_reads enable row level security;

create policy "direct reads: own or about me" on public.direct_reads
  for select to authenticated using (user_id = auth.uid() or peer_id = auth.uid());
create policy "direct reads: write own" on public.direct_reads
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id) and public.is_member_of(peer_id, challenge_id));
create policy "direct reads: update own" on public.direct_reads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reactions ---------------------------------------------------------------------
create table public.message_reactions (
  message_id uuid not null references public.squad_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index message_reactions_message_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

-- The subquery runs with the caller's rights, so a reaction is only visible
-- (and only allowed) on a message the caller can see.
create policy "message reactions: read visible" on public.message_reactions
  for select to authenticated using (exists (select 1 from public.squad_messages m where m.id = message_id));
create policy "message reactions: add own" on public.message_reactions
  for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.squad_messages m where m.id = message_id));
create policy "message reactions: remove own" on public.message_reactions
  for delete to authenticated using (user_id = auth.uid());

-- Push for private messages -------------------------------------------------------
alter table public.notification_settings add column direct boolean not null default true;

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
      when 'direct' then coalesce(n.direct, true)
      when 'mentions' then coalesce(n.mentions, true)
      when 'recipes' then coalesce(n.recipes, true)
      when 'jokers' then coalesce(n.jokers, true)
      when 'compliments' then coalesce(n.compliments, true)
      else false
    end;
$$;

-- Live updates for reactions and read ticks ----------------------------------------
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.direct_reads;
