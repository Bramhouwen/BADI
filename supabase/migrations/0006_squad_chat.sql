-- ---------------------------------------------------------------------------
-- 0006: Squad chat
--
-- One group conversation per challenge. Members read everything in their
-- squad, write as themselves and can delete their own messages. Read state
-- is stored per member so unread counts work across devices.
-- ---------------------------------------------------------------------------

create table public.squad_messages (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index squad_messages_challenge_idx on public.squad_messages (challenge_id, created_at desc);

alter table public.squad_messages enable row level security;

create policy "squad messages: members read" on public.squad_messages
  for select to authenticated using (public.is_member(challenge_id));
create policy "squad messages: insert own" on public.squad_messages
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "squad messages: delete own" on public.squad_messages
  for delete to authenticated using (user_id = auth.uid());

create table public.squad_chat_reads (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.squad_chat_reads enable row level security;

create policy "chat reads: own" on public.squad_chat_reads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));

alter publication supabase_realtime add table public.squad_messages;
