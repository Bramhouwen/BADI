-- ---------------------------------------------------------------------------
-- 0024: Weekrad (weekly spin wheel), prizes and the prize cabinet
--
-- Every member gets one spin per calendar week (Monday 00:00 Europe/Amsterdam
-- to Sunday). The outcome is decided in spin_wheel(): first a category by the
-- weights the admin sets, then a random available prize in it. Stock is
-- reserved in the same transaction, so two spins can never take the last one.
-- The "challenge" category always has something: an extra week challenge.
--
-- Prizes are handed over in person, so no address is stored. Gift card codes
-- live in their own table, readable only by the winner and the admin.
-- ---------------------------------------------------------------------------

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

create table public.wheel_categories (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  key text not null check (key in ('food', 'hydration', 'sport', 'voucher', 'challenge')),
  weight int not null check (weight between 0 and 100),
  primary key (challenge_id, key)
);

insert into public.wheel_categories (challenge_id, key, weight)
select c.id, d.key, d.weight
from public.challenges c
cross join (values ('food', 40), ('hydration', 10), ('sport', 5), ('voucher', 10), ('challenge', 35)) as d(key, weight)
on conflict do nothing;

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  category text not null check (category in ('food', 'hydration', 'sport', 'voucher')),
  brand text not null check (char_length(brand) between 1 and 60),
  name text not null check (char_length(name) between 1 and 80),
  -- Short introduction of the brand and product for the winner.
  description text check (description is null or char_length(description) <= 600),
  -- What it is worth, e.g. the amount on a gift card; shown to the winner.
  value_cents int check (value_cents is null or value_cents >= 0),
  url text check (url is null or url ~* '^https?://'),
  image_path text,
  -- Choice the winner makes when claiming, e.g. "Maat" with S, M, L.
  variant_label text check (variant_label is null or char_length(variant_label) <= 30),
  variants text[] not null default '{}',
  -- Gift cards: the admin adds a code after the win.
  needs_code boolean not null default false,
  stock int not null default 0 check (stock >= 0),
  weekly_max int check (weekly_max is null or weekly_max >= 1),
  cost_cents int not null default 0 check (cost_cents >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prizes_challenge_idx on public.prizes (challenge_id, category);

create table public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  category text not null check (category in ('food', 'hydration', 'sport', 'voucher', 'challenge')),
  prize_id uuid references public.prizes (id) on delete set null,
  -- Snapshot, so the cabinet still reads right if the prize is edited later.
  prize_brand text,
  prize_name text,
  challenge_key text check (challenge_key is null or challenge_key in ('hydration', 'movement', 'sleep', 'food', 'buddy')),
  challenge_completed_at timestamptz,
  variant text check (variant is null or char_length(variant) <= 40),
  status text not null check (status in ('won', 'claimed', 'ordered', 'delivered', 'challenge')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  unique (user_id, week_start),
  check ((category = 'challenge') = (challenge_key is not null)),
  check ((category = 'challenge') = (status = 'challenge'))
);

create index wheel_spins_challenge_idx on public.wheel_spins (challenge_id, week_start);

create table public.wheel_codes (
  spin_id uuid primary key references public.wheel_spins (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 120),
  created_at timestamptz not null default now()
);

alter table public.wheel_categories enable row level security;
alter table public.prizes enable row level security;
alter table public.wheel_spins enable row level security;
alter table public.wheel_codes enable row level security;

create policy "wheel categories: members read" on public.wheel_categories
  for select to authenticated using (public.is_member(challenge_id));
create policy "wheel categories: admin update" on public.wheel_categories
  for update to authenticated using (public.is_admin(challenge_id)) with check (public.is_admin(challenge_id));

create policy "prizes: members read" on public.prizes
  for select to authenticated using (public.is_member(challenge_id));
create policy "prizes: admin insert" on public.prizes
  for insert to authenticated with check (public.is_admin(challenge_id));
create policy "prizes: admin update" on public.prizes
  for update to authenticated using (public.is_admin(challenge_id)) with check (public.is_admin(challenge_id));
create policy "prizes: admin delete" on public.prizes
  for delete to authenticated using (public.is_admin(challenge_id));

-- Spins are made by spin_wheel() only; the squad sees who won what.
create policy "spins: members read" on public.wheel_spins
  for select to authenticated using (public.is_member(challenge_id));
create policy "spins: admin update" on public.wheel_spins
  for update to authenticated using (public.is_admin(challenge_id)) with check (public.is_admin(challenge_id));

create policy "codes: winner and admin read" on public.wheel_codes
  for select to authenticated using (
    exists (
      select 1 from public.wheel_spins s
      where s.id = spin_id and (s.user_id = auth.uid() or public.is_admin(s.challenge_id))
    )
  );
create policy "codes: admin write" on public.wheel_codes
  for all to authenticated
  using (exists (select 1 from public.wheel_spins s where s.id = spin_id and public.is_admin(s.challenge_id)))
  with check (exists (select 1 from public.wheel_spins s where s.id = spin_id and public.is_admin(s.challenge_id)));

-- Monday of the current week in the challenge timezone.
create or replace function public.wheel_week_start(p_challenge uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select date_trunc('week', (now() at time zone coalesce((select timezone from public.challenges where id = p_challenge), 'Europe/Amsterdam')))::date;
$$;

-- Prizes that can still be won this week: active, in stock, under the weekly cap.
create or replace function public.wheel_available_prizes(p_challenge uuid, p_week date)
returns setof public.prizes
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.prizes p
  where p.challenge_id = p_challenge
    and p.active
    and p.stock > 0
    and (
      p.weekly_max is null
      or (select count(*) from public.wheel_spins s where s.prize_id = p.id and s.week_start = p_week) < p.weekly_max
    );
$$;

revoke all on function public.wheel_available_prizes(uuid, date) from public, anon;

-- The spin. Returns the new spin row. Errors: NOT_MEMBER, ALREADY_SPUN.
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
  from (values ('food', 40), ('hydration', 10), ('sport', 5), ('voucher', 10), ('challenge', 35)) as d(key, weight)
  on conflict do nothing;

  -- Step 1: a category, weighted, among those that have something to win.
  select coalesce(sum(c.weight), 0) into v_total
  from public.wheel_categories c
  where c.challenge_id = p_challenge and c.weight > 0
    and (c.key = 'challenge' or exists (select 1 from public.wheel_available_prizes(p_challenge, v_week) a where a.category = c.key));

  if v_total = 0 then
    v_category := 'challenge';
  else
    v_pick := floor(random() * v_total)::int;
    for v_row in
      select c.key, c.weight
      from public.wheel_categories c
      where c.challenge_id = p_challenge and c.weight > 0
        and (c.key = 'challenge' or exists (select 1 from public.wheel_available_prizes(p_challenge, v_week) a where a.category = c.key))
      order by array_position(array['food', 'hydration', 'sport', 'voucher', 'challenge'], c.key)
    loop
      if v_pick < v_row.weight then
        v_category := v_row.key;
        exit;
      end if;
      v_pick := v_pick - v_row.weight;
    end loop;
  end if;

  -- Step 2: one prize in that category, or a challenge.
  if v_category = 'challenge' then
    v_challenge := (array['hydration', 'movement', 'sleep', 'food', 'buddy'])[1 + floor(random() * 5)::int];
    insert into public.wheel_spins (challenge_id, user_id, week_start, category, challenge_key, status)
    values (p_challenge, v_user, v_week, 'challenge', v_challenge, 'challenge')
    returning * into v_spin;
  else
    select * into v_prize
    from public.wheel_available_prizes(p_challenge, v_week) a
    where a.category = v_category
    order by random()
    limit 1;

    update public.prizes set stock = stock - 1, updated_at = now()
    where id = v_prize.id and stock > 0;
    if not found then
      raise exception 'OUT_OF_STOCK';
    end if;

    insert into public.wheel_spins (challenge_id, user_id, week_start, category, prize_id, prize_brand, prize_name, status)
    values (p_challenge, v_user, v_week, v_category, v_prize.id, v_prize.brand, v_prize.name, 'won')
    returning * into v_spin;
  end if;

  return v_spin;
end;
$$;

revoke all on function public.spin_wheel(uuid) from public, anon;
grant execute on function public.spin_wheel(uuid) to authenticated;

-- The winner claims a prize, choosing a variant when the prize has them.
create or replace function public.claim_prize(p_spin uuid, p_variant text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_spin public.wheel_spins;
  v_variants text[];
begin
  select * into v_spin from public.wheel_spins where id = p_spin and user_id = auth.uid() for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_spin.status <> 'won' then
    raise exception 'ALREADY_CLAIMED';
  end if;
  select variants into v_variants from public.prizes where id = v_spin.prize_id;
  if coalesce(cardinality(v_variants), 0) > 0 and (p_variant is null or not (p_variant = any (v_variants))) then
    raise exception 'PICK_VARIANT';
  end if;
  update public.wheel_spins
  set status = 'claimed', claimed_at = now(), variant = case when coalesce(cardinality(v_variants), 0) > 0 then p_variant else null end
  where id = p_spin;
end;
$$;

revoke all on function public.claim_prize(uuid, text) from public, anon;
grant execute on function public.claim_prize(uuid, text) to authenticated;

-- The winner marks an extra week challenge as completed (checked in the app).
create or replace function public.complete_wheel_challenge(p_spin uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.wheel_spins
  set challenge_completed_at = coalesce(challenge_completed_at, now())
  where id = p_spin and user_id = auth.uid() and category = 'challenge';
$$;

revoke all on function public.complete_wheel_challenge(uuid) from public, anon;
grant execute on function public.complete_wheel_challenge(uuid) to authenticated;

-- Prize photos: members read, the admin uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prizes', 'prizes', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "prize media: members read" on storage.objects
  for select to authenticated using (
    bucket_id = 'prizes' and public.is_member(((storage.foldername(name))[1])::uuid)
  );
create policy "prize media: admin upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'prizes'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_admin(((storage.foldername(name))[1])::uuid)
  );
create policy "prize media: admin delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'prizes' and public.is_admin(((storage.foldername(name))[1])::uuid)
  );

-- Example prizes from the brief: inactive and without stock until the admin
-- has arranged them, so nothing can be won that is not really there.
insert into public.prizes (challenge_id, category, brand, name, variant_label, variants)
select c.id, d.category, d.brand, d.name, d.variant_label, d.variants
from public.challenges c
cross join (values
  ('food', 'Frank & Charlie', 'Drankje naar keuze', 'Smaak', '{}'::text[]),
  ('food', 'Upfront', 'Eiwitreep of snackbox', null, '{}'::text[]),
  ('food', 'Orangefit', 'Proteïnepakket', null, '{}'::text[]),
  ('food', 'Oot Granola', 'Ontbijtpakket', null, '{}'::text[]),
  ('hydration', 'Cabau Lifestyle', 'Bloom Waterfles', 'Kleur', '{}'::text[]),
  ('hydration', 'Cabau Lifestyle', 'Shaker', null, '{}'::text[]),
  ('hydration', 'air up', 'Waterfles', 'Kleur', '{}'::text[]),
  ('hydration', 'Orangefit', 'Fit Shaker', null, '{}'::text[]),
  ('sport', 'Loavies', 'Compleet sportpak', 'Maat', '{}'::text[]),
  ('sport', 'Flowee', 'Ontspannend oogkussen', null, '{}'::text[]),
  ('sport', 'Flowee', 'Relaxpakket', null, '{}'::text[]),
  ('voucher', 'ELVOU', 'Tegoedbon', null, '{}'::text[]),
  ('voucher', 'Cabau Lifestyle', 'Cadeaubon', null, '{}'::text[])
) as d(category, brand, name, variant_label, variants);

update public.prizes set needs_code = true where category = 'voucher';
