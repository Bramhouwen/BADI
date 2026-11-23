-- ---------------------------------------------------------------------------
-- 0028: no prize you already have
--
-- The wheel no longer gives a member a prize they won before (the exact same
-- product). A level with nothing new left for that member drops off their
-- wheel and the other levels keep their ratio, just like a level that is out
-- of stock. Another product of the same brand can still come up; for that the
-- choice to spin again or swap (0025, 0027) stays.
-- ---------------------------------------------------------------------------

-- Only an earlier win makes a prize a duplicate (exact product or same brand),
-- so the first of two wins keeps no "you already have this" choice.
create or replace function public.wheel_is_duplicate(p_spin public.wheel_spins)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_spin.prize_id is not null and exists (
    select 1 from public.wheel_spins s
    where s.user_id = p_spin.user_id
      and s.id <> p_spin.id
      and s.created_at < p_spin.created_at
      and s.prize_id is not null
      and (s.prize_id = p_spin.prize_id or lower(s.prize_brand) = lower(p_spin.prize_brand))
  );
$$;

revoke all on function public.wheel_is_duplicate(public.wheel_spins) from public, anon, authenticated;

-- Available prizes for one member: available for everyone, minus what this
-- member already won.
create or replace function public.wheel_available_for(p_challenge uuid, p_week date, p_user uuid)
returns setof public.prizes
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.wheel_available_prizes(p_challenge, p_week) a
  where not exists (
    select 1 from public.wheel_spins s
    where s.user_id = p_user and s.prize_id = a.id
  );
$$;

revoke all on function public.wheel_available_for(uuid, date, uuid) from public, anon, authenticated;

-- What can be won now by the member asking, for their wheel and "Te winnen".
create or replace function public.wheel_available_ids(p_challenge uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.wheel_available_for(p_challenge, public.wheel_week_start(p_challenge), auth.uid()) a
  where public.is_member(p_challenge);
$$;

revoke all on function public.wheel_available_ids(uuid) from public, anon;
grant execute on function public.wheel_available_ids(uuid) to authenticated;

-- The spin, now from the prizes this member has not won yet. Returns the new
-- spin row. Errors: NOT_MEMBER, ALREADY_SPUN.
create or replace function public.spin_wheel(p_challenge uuid)
returns public.wheel_spins
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_week date;
  v_category text;
  v_total int;
  v_pick int;
  v_prize public.prizes;
  v_challenge text;
  v_spin public.wheel_spins;
  v_row record;
begin
  if v_user is null or not public.is_member(p_challenge) then
    raise exception 'NOT_MEMBER';
  end if;

  -- One spin at a time per challenge: stock and weekly caps stay correct.
  perform pg_advisory_xact_lock(hashtext('wheel:' || p_challenge::text));

  v_week := public.wheel_week_start(p_challenge);
  if exists (select 1 from public.wheel_spins where user_id = v_user and week_start = v_week) then
    raise exception 'ALREADY_SPUN';
  end if;

  insert into public.wheel_categories (challenge_id, key, weight)
  select p_challenge, d.key, d.weight
  from (values ('small', 35), ('medium', 20), ('large', 8), ('jackpot', 2), ('challenge', 35)) as d(key, weight)
  on conflict do nothing;

  -- Step 1: a level, by its chance, among those that have something to win.
  select coalesce(sum(c.weight), 0) into v_total
  from public.wheel_categories c
  where c.challenge_id = p_challenge and c.weight > 0
    and (c.key = 'challenge' or exists (select 1 from public.wheel_available_for(p_challenge, v_week, v_user) a where a.category = c.key));

  if v_total = 0 then
    v_category := 'challenge';
  else
    v_pick := floor(random() * v_total)::int;
    for v_row in
      select c.key, c.weight
      from public.wheel_categories c
      where c.challenge_id = p_challenge and c.weight > 0
        and (c.key = 'challenge' or exists (select 1 from public.wheel_available_for(p_challenge, v_week, v_user) a where a.category = c.key))
      order by array_position(array['small', 'medium', 'large', 'jackpot', 'challenge'], c.key)
    loop
      if v_pick < v_row.weight then
        v_category := v_row.key;
        exit;
      end if;
      v_pick := v_pick - v_row.weight;
    end loop;
  end if;

  -- Step 2: one prize in that level by product weight, or a challenge.
  if v_category = 'challenge' then
    v_challenge := (array['energizer', 'buddy', 'recipe', 'lunch', 'relax'])[1 + floor(random() * 5)::int];
    insert into public.wheel_spins (challenge_id, user_id, week_start, category, challenge_key, status)
    values (p_challenge, v_user, v_week, 'challenge', v_challenge, 'challenge')
    returning * into v_spin;
  else
    -- Weighted random pick: the smallest -ln(u) / weight wins.
    select * into v_prize
    from public.wheel_available_for(p_challenge, v_week, v_user) a
    where a.category = v_category
    order by -ln(1 - random()) / a.weight
    limit 1;

    update public.prizes set stock = stock - 1, updated_at = now()
    where id = v_prize.id and stock > 0;
    if not found then
      raise exception 'OUT_OF_STOCK';
    end if;

    insert into public.wheel_spins (challenge_id, user_id, week_start, category, prize_id, prize_brand, prize_name, cost_cents, status)
    values (p_challenge, v_user, v_week, v_category, v_prize.id, v_prize.brand, v_prize.name,
            greatest(0, v_prize.cost_cents + v_prize.shipping_cents - v_prize.sponsored_cents), 'won')
    returning * into v_spin;
  end if;

  return v_spin;
end;
$$;

revoke all on function public.spin_wheel(uuid) from public, anon;
grant execute on function public.spin_wheel(uuid) to authenticated;
