-- ---------------------------------------------------------------------------
-- 0032: BADI Wereld, fase 4. Own rooms, the shop and coins.
--
-- Coins are earned with real actions in BADI and worked out here, from the
-- database, never by the app: per day 5 for a check-in, 10 for a completed
-- training, 3 for 2,5 liter water and 5 for 10.000 steps.
-- You spend them in the shop. Buying only goes through world_buy(), which
-- checks your balance and the price; there is no other way to add a purchase.
-- Everyone in the group sees how your room is furnished (to visit it); only
-- you change it. Notes left in a room are only for the room's owner and the
-- one who wrote it.
-- ---------------------------------------------------------------------------

-- The shop: the price of every piece (same as src/lib/world/items.ts).
create table if not exists public.world_shop_items (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  price int not null check (price between 0 and 10000),
  active boolean not null default true
);
alter table public.world_shop_items enable row level security;
drop policy if exists "world shop: everyone reads" on public.world_shop_items;
create policy "world shop: everyone reads" on public.world_shop_items for select to authenticated using (true);

insert into public.world_shop_items (id, price) values
  ('bank', 80), ('fauteuil', 55), ('zitzak', 35), ('bureaustoel', 30), ('bed', 100), ('bureau', 60),
  ('boekenkast', 50), ('kledingkast', 70), ('tv-meubel', 70), ('trofeekast', 90), ('bijzettafel', 20),
  ('plant', 30), ('plantenrek', 35), ('cactus', 15), ('halterrek', 80), ('hometrainer', 120),
  ('yogamat', 25), ('kleed-rond', 40), ('kleed-rechthoek', 35), ('vloerlamp', 30)
on conflict (id) do update set price = excluded.price, active = true;

-- What you bought. Only through world_buy(): no insert, update or delete for anyone.
create table if not exists public.world_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  item_id text not null references public.world_shop_items (id),
  price int not null check (price >= 0),
  created_at timestamptz not null default now()
);
create index if not exists world_purchases_user_idx on public.world_purchases (user_id);
alter table public.world_purchases enable row level security;
drop policy if exists "world purchases: read own" on public.world_purchases;
create policy "world purchases: read own" on public.world_purchases for select to authenticated using (user_id = auth.uid());
-- And no rights to change them at all, besides the missing policies.
revoke insert, update, delete on public.world_purchases from authenticated, anon;

-- How your room is furnished: one row per piece that stands in it (the rest is in storage).
create table if not exists public.world_room_items (
  purchase_id uuid primary key references public.world_purchases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  item_id text not null,
  u int not null check (u between 0 and 64),
  v int not null check (v between 0 and 64),
  flip boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists world_room_items_user_idx on public.world_room_items (user_id);
alter table public.world_room_items enable row level security;
drop policy if exists "world room: group reads" on public.world_room_items;
create policy "world room: group reads" on public.world_room_items for select to authenticated using (public.is_member(challenge_id));
-- You place, move and store only what you bought yourself, as what you bought.
drop policy if exists "world room: place own" on public.world_room_items;
create policy "world room: place own" on public.world_room_items for insert to authenticated with check (
  user_id = auth.uid() and public.is_member(challenge_id)
  and exists (select 1 from public.world_purchases p where p.id = purchase_id and p.user_id = auth.uid() and p.item_id = world_room_items.item_id and p.challenge_id = world_room_items.challenge_id)
);
drop policy if exists "world room: move own" on public.world_room_items;
create policy "world room: move own" on public.world_room_items for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.world_purchases p where p.id = purchase_id and p.user_id = auth.uid() and p.item_id = world_room_items.item_id));
drop policy if exists "world room: store own" on public.world_room_items;
create policy "world room: store own" on public.world_room_items for delete to authenticated using (user_id = auth.uid());

-- Notes and high fives left in someone's room.
create table if not exists public.world_notes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  room_owner uuid not null references public.profiles (id) on delete cascade,
  author uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('briefje', 'highfive')),
  body text check (body is null or char_length(body) between 1 and 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (room_owner <> author)
);
create index if not exists world_notes_owner_idx on public.world_notes (room_owner, created_at desc);
alter table public.world_notes enable row level security;
drop policy if exists "world notes: owner and author read" on public.world_notes;
create policy "world notes: owner and author read" on public.world_notes for select to authenticated using (auth.uid() in (room_owner, author));
drop policy if exists "world notes: leave in a room" on public.world_notes;
create policy "world notes: leave in a room" on public.world_notes for insert to authenticated with check (
  author = auth.uid() and public.is_member(challenge_id) and public.is_member_of(room_owner, challenge_id)
);
drop policy if exists "world notes: owner marks read" on public.world_notes;
create policy "world notes: owner marks read" on public.world_notes for update to authenticated using (room_owner = auth.uid()) with check (room_owner = auth.uid());
drop policy if exists "world notes: owner or author removes" on public.world_notes;
create policy "world notes: owner or author removes" on public.world_notes for delete to authenticated using (auth.uid() in (room_owner, author));
-- The owner may only mark a note as read, never change what someone wrote.
revoke update on public.world_notes from authenticated, anon;
grant update (read_at) on public.world_notes to authenticated;
revoke all on public.world_shop_items from anon;
revoke insert, update, delete on public.world_shop_items from authenticated;

-- Coins earned by the signed-in member in their group, from their own data.
create or replace function public.world_coins_earned()
returns int
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select m.user_id, m.challenge_id, c.start_date, (now() at time zone c.timezone)::date as today
    from public.memberships m join public.challenges c on c.id = m.challenge_id
    where m.user_id = auth.uid()
  ),
  days as (
    select 5 as coins from public.daily_checkins d, me
      where d.user_id = me.user_id and d.challenge_id = me.challenge_id and d.checkin_date between me.start_date and me.today
    union all
    select 10 from (
      select distinct w.workout_date from public.workout_sessions w, me
      where w.user_id = me.user_id and w.status = 'completed' and w.workout_date between me.start_date and me.today
    ) t
    union all
    select 3 from (
      select w.log_date from public.water_entries w, me
      where w.user_id = me.user_id and w.challenge_id = me.challenge_id and w.log_date between me.start_date and me.today
      group by w.log_date having sum(w.amount_ml) >= 2500
    ) t
    union all
    select 5 from (
      select s.log_date from public.step_logs s, me
      where s.user_id = me.user_id and s.log_date between me.start_date and me.today
      group by s.log_date having max(s.steps) >= 10000
    ) t
  )
  select coalesce(sum(coins), 0)::int from days;
$$;

-- What the signed-in member can still spend.
create or replace function public.world_coins_balance()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.world_coins_earned() - coalesce((select sum(price) from public.world_purchases where user_id = auth.uid()), 0)::int;
$$;

-- Buy a piece: checks the price in the shop and your balance, then records the purchase.
create or replace function public.world_buy(p_item text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_challenge uuid;
  v_price int;
  v_id uuid;
begin
  if v_user is null then raise exception 'Niet ingelogd.'; end if;
  select challenge_id into v_challenge from public.memberships where user_id = v_user;
  if v_challenge is null then raise exception 'Geen groep.'; end if;
  select price into v_price from public.world_shop_items where id = p_item and active;
  if v_price is null then raise exception 'Dit is niet te koop.'; end if;
  -- One purchase at a time per member, so two quick taps cannot spend the same coins twice.
  perform pg_advisory_xact_lock(hashtext('world_buy:' || v_user::text));
  if public.world_coins_balance() < v_price then raise exception 'Niet genoeg munten.'; end if;
  insert into public.world_purchases (user_id, challenge_id, item_id, price) values (v_user, v_challenge, p_item, v_price) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.world_coins_earned() from public;
revoke all on function public.world_coins_balance() from public;
revoke all on function public.world_buy(text) from public;
grant execute on function public.world_coins_earned() to authenticated;
grant execute on function public.world_coins_balance() to authenticated;
grant execute on function public.world_buy(text) to authenticated;
