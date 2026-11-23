-- ---------------------------------------------------------------------------
-- 0027: a prize counts as a duplicate when you already won something of the
-- same brand, not only the exact same product. You may then spin again or
-- swap for a prize in the same level of a brand you do not have yet.
-- ---------------------------------------------------------------------------

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
      and s.prize_id is not null
      and (s.prize_id = p_spin.prize_id or lower(s.prize_brand) = lower(p_spin.prize_brand))
  );
$$;

revoke all on function public.wheel_is_duplicate(public.wheel_spins) from public, anon, authenticated;

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
  -- Another prize in the same level, of a brand this member has not won yet.
  select a.* into v_prize
  from public.wheel_available_prizes(v_spin.challenge_id, v_spin.week_start) a
  where a.id = p_prize
    and a.category = v_spin.category
    and lower(a.brand) <> lower(v_spin.prize_brand)
    and not exists (
      select 1 from public.wheel_spins s
      where s.user_id = v_spin.user_id and s.id <> v_spin.id
        and (s.prize_id = a.id or lower(s.prize_brand) = lower(a.brand))
    );
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
