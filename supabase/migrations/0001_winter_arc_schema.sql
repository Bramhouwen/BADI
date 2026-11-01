-- WINTER ARC schema
-- Run in the Supabase SQL editor or with `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'lid'), '@', 1)
  );
  insert into public.profiles (id, display_name)
  values (new.id, left(v_name, 40))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Challenges and memberships
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  start_date date not null,
  end_date date not null,
  timezone text not null default 'Europe/Amsterdam',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (challenge_id, user_id),
  unique (user_id) -- one challenge per person keeps the app simple
);

create index memberships_challenge_idx on public.memberships (challenge_id);

-- Max four members per challenge, enforced under a lock to avoid races.
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('memberships:' || new.challenge_id::text));
  select count(*) into v_count from public.memberships where challenge_id = new.challenge_id;
  if v_count >= 4 then
    raise exception 'MEMBER_LIMIT_REACHED' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger memberships_limit
  before insert on public.memberships
  for each row execute function public.enforce_member_limit();

-- Helper: is the current user a member of a challenge?
create or replace function public.is_member(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where challenge_id = p_challenge and user_id = auth.uid()
  );
$$;

create or replace function public.is_admin(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where challenge_id = p_challenge and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_challenge_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select challenge_id from public.memberships where user_id = auth.uid() limit 1;
$$;

create or replace function public.shares_challenge_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.challenge_id = b.challenge_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Invitations (single use, hashed token, expiry)
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  token_hash text not null unique,
  invited_email text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invitations_challenge_idx on public.invitations (challenge_id);

-- ---------------------------------------------------------------------------
-- Daily check-ins
-- ---------------------------------------------------------------------------
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkin_date date not null,
  activities text[] not null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id, checkin_date),
  check (cardinality(activities) between 1 and 6),
  check (activities <@ array['moved', 'strength', 'nutrition', 'recovery', 'hydration', 'alcohol']::text[])
);

create index daily_checkins_user_idx on public.daily_checkins (challenge_id, user_id, checkin_date);

-- Only today or yesterday (challenge timezone) inside the challenge period.
create or replace function public.enforce_checkin_window()
returns trigger
language plpgsql
as $$
declare
  c public.challenges%rowtype;
  v_today date;
begin
  select * into c from public.challenges where id = new.challenge_id;
  if c.id is null then
    raise exception 'CHALLENGE_NOT_FOUND';
  end if;
  if not public.is_member(new.challenge_id) or new.user_id <> auth.uid() then
    raise exception 'NOT_A_MEMBER' using errcode = 'insufficient_privilege';
  end if;
  v_today := (now() at time zone c.timezone)::date;
  if new.checkin_date < c.start_date or new.checkin_date > c.end_date then
    raise exception 'CHECKIN_OUTSIDE_CHALLENGE' using errcode = 'check_violation';
  end if;
  if new.checkin_date <> v_today and new.checkin_date <> v_today - 1 then
    raise exception 'CHECKIN_OUTSIDE_WINDOW' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.checkin_date <> new.checkin_date then
    raise exception 'CHECKIN_DATE_IMMUTABLE' using errcode = 'check_violation';
  end if;
  -- De-duplicate and keep a stable order in the activities array.
  select array_agg(distinct a order by a) into new.activities from unnest(new.activities) as a;
  new.updated_at := now();
  return new;
end;
$$;

create trigger daily_checkins_window
  before insert or update on public.daily_checkins
  for each row execute function public.enforce_checkin_window();

create or replace function public.enforce_checkin_delete_window()
returns trigger
language plpgsql
as $$
declare
  c public.challenges%rowtype;
  v_today date;
begin
  select * into c from public.challenges where id = old.challenge_id;
  v_today := (now() at time zone c.timezone)::date;
  if old.checkin_date <> v_today and old.checkin_date <> v_today - 1 then
    raise exception 'CHECKIN_OUTSIDE_WINDOW' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger daily_checkins_delete_window
  before delete on public.daily_checkins
  for each row execute function public.enforce_checkin_delete_window();

-- ---------------------------------------------------------------------------
-- Kitchen
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  ingredients text check (ingredients is null or char_length(ingredients) <= 2000),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  category text check (category is null or char_length(category) <= 30),
  protein_grams int check (protein_grams is null or protein_grams between 0 and 300),
  image_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_challenge_idx on public.recipes (challenge_id, created_at desc);

create table public.recipe_favorites (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (recipe_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Wall
-- ---------------------------------------------------------------------------
create table public.wall_posts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_path text not null,
  caption text check (caption is null or char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wall_posts_challenge_idx on public.wall_posts (challenge_id, created_at desc);

create table public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wall_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'muscle', 'heart', 'snow', 'clap')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index post_reactions_post_idx on public.post_reactions (post_id);

-- ---------------------------------------------------------------------------
-- Compliments
-- ---------------------------------------------------------------------------
create table public.compliments (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 140),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> receiver_id)
);

create index compliments_receiver_idx on public.compliments (receiver_id, created_at desc);
create index compliments_sender_idx on public.compliments (sender_id, created_at desc);

-- Gentle rate limit: max 1 per 15 seconds and max 20 per hour per sender.
create or replace function public.enforce_compliment_rate_limit()
returns trigger
language plpgsql
as $$
declare
  v_recent int;
  v_last timestamptz;
begin
  if not public.is_member(new.challenge_id) or not public.shares_challenge_with(new.receiver_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'insufficient_privilege';
  end if;
  select max(created_at) into v_last from public.compliments where sender_id = new.sender_id;
  if v_last is not null and v_last > now() - interval '15 seconds' then
    raise exception 'COMPLIMENT_TOO_FAST' using errcode = 'check_violation';
  end if;
  select count(*) into v_recent from public.compliments
  where sender_id = new.sender_id and created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'COMPLIMENT_RATE_LIMIT' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger compliments_rate_limit
  before insert on public.compliments
  for each row execute function public.enforce_compliment_rate_limit();

-- ---------------------------------------------------------------------------
-- Alcohol exceptions (private, max two)
-- ---------------------------------------------------------------------------
create table public.alcohol_exceptions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  exception_date date not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id, exception_date)
);

create or replace function public.enforce_alcohol_exception_limit()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count from public.alcohol_exceptions
  where challenge_id = new.challenge_id and user_id = new.user_id;
  if v_count >= 2 then
    raise exception 'ALCOHOL_EXCEPTION_LIMIT' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger alcohol_exceptions_limit
  before insert on public.alcohol_exceptions
  for each row execute function public.enforce_alcohol_exception_limit();

-- ---------------------------------------------------------------------------
-- Notifications (filled by triggers)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  type text not null check (type in ('compliment', 'reaction', 'post', 'recipe')),
  actor_id uuid references public.profiles (id) on delete cascade,
  ref_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify_on_compliment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, challenge_id, type, actor_id, ref_id)
  values (new.receiver_id, new.challenge_id, 'compliment', new.sender_id, new.id);
  return new;
end;
$$;

create trigger compliments_notify
  after insert on public.compliments
  for each row execute function public.notify_on_compliment();

create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_challenge uuid;
begin
  select user_id, challenge_id into v_owner, v_challenge from public.wall_posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.notifications (user_id, challenge_id, type, actor_id, ref_id)
    values (v_owner, v_challenge, 'reaction', new.user_id, new.post_id);
  end if;
  return new;
end;
$$;

create trigger post_reactions_notify
  after insert on public.post_reactions
  for each row execute function public.notify_on_reaction();

create or replace function public.notify_members_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, challenge_id, type, actor_id, ref_id)
  select m.user_id, new.challenge_id, 'post', new.user_id, new.id
  from public.memberships m
  where m.challenge_id = new.challenge_id and m.user_id <> new.user_id;
  return new;
end;
$$;

create trigger wall_posts_notify
  after insert on public.wall_posts
  for each row execute function public.notify_members_on_post();

create or replace function public.notify_members_on_recipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, challenge_id, type, actor_id, ref_id)
  select m.user_id, new.challenge_id, 'recipe', new.user_id, new.id
  from public.memberships m
  where m.challenge_id = new.challenge_id and m.user_id <> new.user_id;
  return new;
end;
$$;

create trigger recipes_notify
  after insert on public.recipes
  for each row execute function public.notify_members_on_recipe();

-- ---------------------------------------------------------------------------
-- Generic updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger recipes_touch before update on public.recipes for each row execute function public.touch_updated_at();
create trigger wall_posts_touch before update on public.wall_posts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- First member creates the challenge and becomes admin.
create or replace function public.create_challenge(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_timezone text default 'Europe/Amsterdam'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.memberships where user_id = v_uid) then
    raise exception 'ALREADY_MEMBER' using errcode = 'check_violation';
  end if;
  insert into public.challenges (name, start_date, end_date, timezone, created_by)
  values (p_name, p_start_date, p_end_date, p_timezone, v_uid)
  returning id into v_id;
  insert into public.memberships (challenge_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;

-- Admin creates a single-use invitation. Returns the raw token (only shown once).
create or replace function public.create_invitation(p_invited_email text default null)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge uuid;
  v_token text;
  v_members int;
begin
  select challenge_id into v_challenge from public.memberships where user_id = v_uid and role = 'admin';
  if v_challenge is null then
    raise exception 'NOT_ADMIN' using errcode = 'insufficient_privilege';
  end if;
  select count(*) into v_members from public.memberships where challenge_id = v_challenge;
  if v_members >= 4 then
    raise exception 'MEMBER_LIMIT_REACHED' using errcode = 'check_violation';
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.invitations (challenge_id, token_hash, invited_email, created_by, expires_at)
  values (v_challenge, encode(digest(v_token, 'sha256'), 'hex'), nullif(lower(trim(p_invited_email)), ''), v_uid, now() + interval '7 days');
  return v_token;
end;
$$;

-- Invitee accepts with the raw token. Returns the challenge id.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations%rowtype;
  v_email text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.memberships where user_id = v_uid) then
    raise exception 'ALREADY_MEMBER' using errcode = 'check_violation';
  end if;
  select * into v_inv from public.invitations
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if v_inv.id is null then
    raise exception 'INVITE_INVALID' using errcode = 'check_violation';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'INVITE_USED' using errcode = 'check_violation';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'check_violation';
  end if;
  if v_inv.invited_email is not null then
    select lower(email) into v_email from auth.users where id = v_uid;
    if v_email is distinct from v_inv.invited_email then
      raise exception 'INVITE_EMAIL_MISMATCH' using errcode = 'check_violation';
    end if;
  end if;
  insert into public.memberships (challenge_id, user_id, role) values (v_inv.challenge_id, v_uid, 'member');
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.challenge_id;
end;
$$;

-- Public preview of an invitation (name of the challenge and inviter) without exposing the table.
create or replace function public.preview_invitation(p_token text)
returns table (challenge_name text, inviter_name text, valid boolean, reason text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inv public.invitations%rowtype;
  v_members int;
begin
  select * into v_inv from public.invitations
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if v_inv.id is null then
    return query select null::text, null::text, false, 'INVITE_INVALID'::text; return;
  end if;
  select count(*) into v_members from public.memberships where challenge_id = v_inv.challenge_id;
  return query
    select c.name, p.display_name,
      (v_inv.accepted_at is null and v_inv.expires_at > now() and v_members < 4),
      case
        when v_inv.accepted_at is not null then 'INVITE_USED'
        when v_inv.expires_at <= now() then 'INVITE_EXPIRED'
        when v_members >= 4 then 'MEMBER_LIMIT_REACHED'
        else null
      end
    from public.challenges c
    join public.profiles p on p.id = v_inv.created_by
    where c.id = v_inv.challenge_id;
end;
$$;

-- Mark notifications as read.
create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_favorites enable row level security;
alter table public.wall_posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.compliments enable row level security;
alter table public.alcohol_exceptions enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles: read own and squad" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_challenge_with(id));
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- challenges (writes only via RPC)
create policy "challenges: members read" on public.challenges
  for select to authenticated using (public.is_member(id));

-- memberships (writes only via RPC)
create policy "memberships: members read" on public.memberships
  for select to authenticated using (public.is_member(challenge_id));

-- invitations (creation via RPC, admins can list and revoke)
create policy "invitations: admins read" on public.invitations
  for select to authenticated using (public.is_admin(challenge_id));
create policy "invitations: admins delete" on public.invitations
  for delete to authenticated using (public.is_admin(challenge_id));

-- daily check-ins
create policy "checkins: members read" on public.daily_checkins
  for select to authenticated using (public.is_member(challenge_id));
create policy "checkins: insert own" on public.daily_checkins
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "checkins: update own" on public.daily_checkins
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "checkins: delete own" on public.daily_checkins
  for delete to authenticated using (user_id = auth.uid());

-- recipes
create policy "recipes: members read" on public.recipes
  for select to authenticated using (public.is_member(challenge_id));
create policy "recipes: insert own" on public.recipes
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "recipes: update own" on public.recipes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recipes: delete own" on public.recipes
  for delete to authenticated using (user_id = auth.uid());

-- favorites (private per member)
create policy "favorites: read own" on public.recipe_favorites
  for select to authenticated using (user_id = auth.uid());
create policy "favorites: insert own" on public.recipe_favorites
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.recipes r where r.id = recipe_id and public.is_member(r.challenge_id))
  );
create policy "favorites: delete own" on public.recipe_favorites
  for delete to authenticated using (user_id = auth.uid());

-- wall
create policy "posts: members read" on public.wall_posts
  for select to authenticated using (public.is_member(challenge_id));
create policy "posts: insert own" on public.wall_posts
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "posts: update own" on public.wall_posts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts: delete own" on public.wall_posts
  for delete to authenticated using (user_id = auth.uid());

-- reactions
create policy "reactions: members read" on public.post_reactions
  for select to authenticated using (
    exists (select 1 from public.wall_posts p where p.id = post_id and public.is_member(p.challenge_id))
  );
create policy "reactions: insert own" on public.post_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.wall_posts p where p.id = post_id and public.is_member(p.challenge_id))
  );
create policy "reactions: update own" on public.post_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reactions: delete own" on public.post_reactions
  for delete to authenticated using (user_id = auth.uid());

-- compliments (sender and receiver only; no public counts)
create policy "compliments: read own" on public.compliments
  for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "compliments: send" on public.compliments
  for insert to authenticated with check (sender_id = auth.uid() and public.is_member(challenge_id));
create policy "compliments: receiver marks read" on public.compliments
  for update to authenticated using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

-- alcohol exceptions (strictly private)
create policy "alcohol: own" on public.alcohol_exceptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(challenge_id));

-- notifications
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: update own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.wall_posts;
alter publication supabase_realtime add table public.post_reactions;
alter publication supabase_realtime add table public.compliments;
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.daily_checkins;
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Storage: private buckets with per-challenge folders
-- Path layout: {challenge_id}/{user_id}/{file}  (avatars: {user_id}/{file})
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wall', 'wall', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('recipes', 'recipes', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "media: members read" on storage.objects
  for select to authenticated using (
    bucket_id in ('wall', 'recipes')
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "media: owners upload" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('wall', 'recipes')
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "media: owners update" on storage.objects
  for update to authenticated using (
    bucket_id in ('wall', 'recipes') and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "media: owners delete" on storage.objects
  for delete to authenticated using (
    bucket_id in ('wall', 'recipes') and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "avatars: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

create policy "avatars: owners write" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owners update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owners delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Recipe reactions (lightweight, same set as the Wall)
-- ---------------------------------------------------------------------------
create table public.recipe_reactions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'muscle', 'heart', 'snow', 'clap')),
  created_at timestamptz not null default now(),
  unique (recipe_id, user_id)
);

create index recipe_reactions_recipe_idx on public.recipe_reactions (recipe_id);

alter table public.recipe_reactions enable row level security;

create policy "recipe reactions: members read" on public.recipe_reactions
  for select to authenticated using (
    exists (select 1 from public.recipes r where r.id = recipe_id and public.is_member(r.challenge_id))
  );
create policy "recipe reactions: insert own" on public.recipe_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.recipes r where r.id = recipe_id and public.is_member(r.challenge_id))
  );
create policy "recipe reactions: update own" on public.recipe_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recipe reactions: delete own" on public.recipe_reactions
  for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.recipe_reactions;

-- ---------------------------------------------------------------------------
-- Wrapped: group-level compliment total without exposing who received what.
-- ---------------------------------------------------------------------------
create or replace function public.group_compliment_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.compliments c
  where c.challenge_id = public.current_challenge_id();
$$;
