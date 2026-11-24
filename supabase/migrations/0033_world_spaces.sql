-- World of Badi: 500 coins for every Super Badi win, and extra spaces to
-- unlock from your own room (bathroom, garden, attic, own gym). A space is
-- bought once with coins, starts empty and is furnished like your room.
-- See docs/wereld/WERELD.md.

-- 1. Coins earned: as in 0032, plus 500 for every week you were (one of) the Super Badi.
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
    union all
    select 500 from public.super_badi_awards a, me
      where a.challenge_id = me.challenge_id and me.user_id = any(a.user_ids)
  )
  select coalesce(sum(coins), 0)::int from days;
$$;

-- 2. The spaces, sold in the same shop. Keep the prices equal to SPACES in src/lib/world/spaces.ts.
insert into public.world_shop_items (id, price) values
  ('ruimte-badkamer', 150), ('ruimte-tuin', 200), ('ruimte-zolder', 250), ('ruimte-gym', 300)
on conflict (id) do update set price = excluded.price, active = true;

-- A space can be bought only once per member.
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
  if p_item like 'ruimte-%' and exists (select 1 from public.world_purchases where user_id = v_user and item_id = p_item) then
    raise exception 'Deze ruimte heb je al.';
  end if;
  if public.world_coins_balance() < v_price then raise exception 'Niet genoeg munten.'; end if;
  insert into public.world_purchases (user_id, challenge_id, item_id, price) values (v_user, v_challenge, p_item, v_price) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.world_buy(text) from public;
grant execute on function public.world_buy(text) to authenticated;

-- The spaces someone in your group has unlocked, so visitors can go in too.
-- (world_purchases is only readable for yourself.)
create or replace function public.world_spaces_of(p_owner uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select substr(p.item_id, 8) from public.world_purchases p
  where p.user_id = p_owner and p.item_id like 'ruimte-%' and public.is_member(p.challenge_id);
$$;
revoke all on function public.world_spaces_of(uuid) from public;
grant execute on function public.world_spaces_of(uuid) to authenticated;

-- 3. Furniture per space: 'kamer' is your own room, else the space it stands in.
alter table public.world_room_items add column if not exists space text not null default 'kamer';
alter table public.world_room_items drop constraint if exists world_room_items_space_check;
alter table public.world_room_items add constraint world_room_items_space_check check (space ~ '^[a-z0-9-]{1,40}$');

-- Placing and moving: only your own pieces, and only in your room or a space you unlocked. Never a space itself.
drop policy if exists "world room: place own" on public.world_room_items;
create policy "world room: place own" on public.world_room_items for insert to authenticated with check (
  user_id = auth.uid() and public.is_member(challenge_id)
  and item_id not like 'ruimte-%'
  and exists (select 1 from public.world_purchases p where p.id = purchase_id and p.user_id = auth.uid() and p.item_id = world_room_items.item_id and p.challenge_id = world_room_items.challenge_id)
  and (space = 'kamer' or exists (select 1 from public.world_purchases s where s.user_id = auth.uid() and s.item_id = 'ruimte-' || world_room_items.space))
);
drop policy if exists "world room: move own" on public.world_room_items;
create policy "world room: move own" on public.world_room_items for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and item_id not like 'ruimte-%'
    and exists (select 1 from public.world_purchases p where p.id = purchase_id and p.user_id = auth.uid() and p.item_id = world_room_items.item_id)
    and (space = 'kamer' or exists (select 1 from public.world_purchases s where s.user_id = auth.uid() and s.item_id = 'ruimte-' || world_room_items.space))
  );
