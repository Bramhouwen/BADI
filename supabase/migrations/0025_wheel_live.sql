-- ---------------------------------------------------------------------------
-- 0025: Weekrad live
--
-- 1. Every prize with a brand is on, with a stock so large it never runs out.
--    The partner prizes stay off until there is a partner.
-- 2. A prize you already won before is a duplicate. You may give it back and
--    spin again (wheel_respin), or swap it for another prize in the same
--    level that you do not have yet (wheel_swap_prize). Only while the prize
--    is not claimed yet.
-- ---------------------------------------------------------------------------

update public.prizes
set active = true, stock = 9999, updated_at = now()
where brand <> 'Partner';

-- Did this member win this prize in another spin?
create or replace function public.wheel_is_duplicate(p_spin public.wheel_spins)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_spin.prize_id is not null and exists (
    select 1 from public.wheel_spins s
    where s.user_id = p_spin.user_id and s.prize_id = p_spin.prize_id and s.id <> p_spin.id
  );
$$;

revoke all on function public.wheel_is_duplicate(public.wheel_spins) from public, anon, authenticated;

-- Give a duplicate back and spin again. Returns the new spin.
create or replace function public.wheel_respin(p_spin uuid)
returns public.wheel_spins
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_spin public.wheel_spins;
begin
  select * into v_spin from public.wheel_spins where id = p_spin and user_id = auth.uid() for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_spin.status <> 'won' then
    raise exception 'ALREADY_CLAIMED';
  end if;
  if not public.wheel_is_duplicate(v_spin) then
    raise exception 'NOT_DUPLICATE';
  end if;

  perform pg_advisory_xact_lock(hashtext('wheel:' || v_spin.challenge_id::text));
  update public.prizes set stock = stock + 1, updated_at = now() where id = v_spin.prize_id;
  delete from public.wheel_spins where id = v_spin.id;
  return public.spin_wheel(v_spin.challenge_id);
end;
$$;

revoke all on function public.wheel_respin(uuid) from public, anon;
grant execute on function public.wheel_respin(uuid) to authenticated;

-- Swap a duplicate for another available prize in the same level that this
-- member does not have yet. Returns the updated spin.
create or replace function public.wheel_swap_prize(p_spin uuid, p_prize uuid)
returns public.wheel_spins
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_spin public.wheel_spins;
  v_prize public.prizes;
begin
  select * into v_spin from public.wheel_spins where id = p_spin and user_id = auth.uid() for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_spin.status <> 'won' then
    raise exception 'ALREADY_CLAIMED';
  end if;
  if not public.wheel_is_duplicate(v_spin) then
    raise exception 'NOT_DUPLICATE';
  end if;

  perform pg_advisory_xact_lock(hashtext('wheel:' || v_spin.challenge_id::text));
  select a.* into v_prize
  from public.wheel_available_prizes(v_spin.challenge_id, v_spin.week_start) a
  where a.id = p_prize
    and a.category = v_spin.category
    and a.id <> v_spin.prize_id
    and not exists (select 1 from public.wheel_spins s where s.user_id = v_spin.user_id and s.prize_id = a.id);
  if not found then
    raise exception 'NOT_AVAILABLE';
  end if;

  update public.prizes set stock = stock + 1, updated_at = now() where id = v_spin.prize_id;
  update public.prizes set stock = stock - 1, updated_at = now() where id = v_prize.id and stock > 0;
  if not found then
    raise exception 'NOT_AVAILABLE';
  end if;

  update public.wheel_spins
  set prize_id = v_prize.id,
      prize_brand = v_prize.brand,
      prize_name = v_prize.name,
      cost_cents = greatest(0, v_prize.cost_cents + v_prize.shipping_cents - v_prize.sponsored_cents)
  where id = v_spin.id
  returning * into v_spin;
  return v_spin;
end;
$$;

revoke all on function public.wheel_swap_prize(uuid, uuid) from public, anon;
grant execute on function public.wheel_swap_prize(uuid, uuid) to authenticated;
