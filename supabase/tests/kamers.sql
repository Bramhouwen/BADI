-- ---------------------------------------------------------------------------
-- Test eigen kamers en munten (BADI Wereld, fase 4)
--
-- Draai dit in de SQL Editor van Supabase, na migratie 0032. Het script neemt
-- drie leden van dezelfde groep (A, B en C) en controleert:
--   - kopen kan alleen via world_buy, met genoeg munten en voor de echte prijs;
--   - niemand kan zelf een aankoop toevoegen of een prijs veranderen;
--   - alleen jij zet en verschuift meubels in je eigen kamer;
--   - een briefje is alleen voor de eigenaar van de kamer en de schrijver;
--   - de eigenaar kan een briefje alleen als gelezen markeren, niet veranderen.
-- Alles wordt teruggedraaid: er blijft niets achter.
-- Uitkomst: een tabel met per stap "OK: ..." of "FOUT: ...".
-- ---------------------------------------------------------------------------

create temp table if not exists kamertest (stap int, uitkomst text);
truncate kamertest;

create or replace function pg_temp.als(p_user uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end;
$$;

do $$
declare
  log text[] := '{}';
  ch uuid; members uuid[]; a uuid; b uuid; c uuid;
  buy uuid; n int; ok boolean; note uuid;
begin
  begin
    select challenge_id into ch from public.memberships group by challenge_id having count(*) >= 3 order by count(*) desc limit 1;
    if ch is null then raise exception 'FOUT: geen groep met minstens drie leden gevonden.'; end if;
    select array_agg(user_id order by joined_at) into members from public.memberships where challenge_id = ch;
    a := members[1]; b := members[2]; c := members[3];

    -- Voorbereiding (als beheerder): de cactus kost in deze test 15 en A traint vandaag (10 munten),
    -- zodat de test niet afhangt van echte munten. Alles wordt aan het eind teruggedraaid.
    update public.world_shop_items set price = 15 where id = 'cactus';
    delete from public.world_purchases where user_id = a;
    insert into public.workout_sessions (user_id, challenge_id, activity_type, title, workout_date, status)
      values (a, ch, 'run', 'test', (now() at time zone (select timezone from public.challenges where id = ch))::date, 'completed');
    insert into public.daily_checkins (challenge_id, user_id, checkin_date, activities)
      values (ch, a, (now() at time zone (select timezone from public.challenges where id = ch))::date, array['moved'])
      on conflict (challenge_id, user_id, checkin_date) do nothing;

    -- 1. A koopt een cactus via world_buy.
    perform pg_temp.als(a);
    if public.world_coins_balance() < 15 then raise exception 'FOUT: A heeft na een training en check-in nog geen 15 munten.'; end if;
    buy := public.world_buy('cactus');
    log := log || 'OK: A koopt een cactus via world_buy.'::text;

    -- 2. Iets duurders dan je saldo lukt niet.
    ok := false;
    begin
      perform public.world_buy('hometrainer');
      ok := public.world_coins_balance() >= 0;
    exception when others then ok := true;
    end;
    if not ok then raise exception 'FOUT: A kon kopen met te weinig munten.'; end if;
    log := log || 'OK: kopen met te weinig munten lukt niet.'::text;

    -- 3. Zelf een aankoop toevoegen of een prijs veranderen kan niet.
    ok := false;
    begin
      insert into public.world_purchases (user_id, challenge_id, item_id, price) values (a, ch, 'bed', 0);
    exception when insufficient_privilege then ok := true;
    end;
    if not ok then raise exception 'FOUT: A kon zelf een gratis bed toevoegen.'; end if;
    n := 0;
    begin
      update public.world_purchases set price = 0 where id = buy;
      get diagnostics n = row_count;
    exception when insufficient_privilege then n := 0;
    end;
    if n <> 0 then raise exception 'FOUT: A kon de prijs van een aankoop veranderen.'; end if;
    ok := false;
    begin
      update public.world_shop_items set price = 0 where id = 'bed';
      get diagnostics n = row_count;
      ok := n = 0;
    exception when insufficient_privilege then ok := true;
    end;
    if not ok then raise exception 'FOUT: A kon een prijs in de winkel veranderen.'; end if;
    log := log || 'OK: niemand kan zelf een aankoop toevoegen, een prijs veranderen of de winkel aanpassen.'::text;

    -- 4. A zet de cactus in de eigen kamer, en kan er geen hometrainer van maken.
    insert into public.world_room_items (purchase_id, user_id, challenge_id, item_id, u, v) values (buy, a, ch, 'cactus', 5, 5);
    ok := false;
    begin
      update public.world_room_items set item_id = 'hometrainer' where purchase_id = buy;
    exception when insufficient_privilege or check_violation then ok := true;
    end;
    if not ok then raise exception 'FOUT: A kon de cactus veranderen in een hometrainer.'; end if;
    log := log || 'OK: A zet de cactus in de eigen kamer; een meubel blijft wat je kocht.'::text;

    -- 5. B ziet de kamer van A (op bezoek), maar kan er niets in veranderen.
    perform pg_temp.als(b);
    select count(*) into n from public.world_room_items where purchase_id = buy;
    if n <> 1 then raise exception 'FOUT: B ziet de kamer van A niet.'; end if;
    update public.world_room_items set u = 1 where purchase_id = buy;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FOUT: B kon een meubel van A verschuiven.'; end if;
    delete from public.world_room_items where purchase_id = buy;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FOUT: B kon een meubel van A weghalen.'; end if;
    ok := false;
    begin
      insert into public.world_room_items (purchase_id, user_id, challenge_id, item_id, u, v) values (buy, b, ch, 'cactus', 1, 1);
    exception when insufficient_privilege or unique_violation then ok := true;
    end;
    if not ok then raise exception 'FOUT: B kon de cactus van A in de eigen kamer zetten.'; end if;
    select count(*) into n from public.world_purchases where user_id = a;
    if n <> 0 then raise exception 'FOUT: B ziet wat A kocht.'; end if;
    log := log || 'OK: B ziet de kamer van A, maar kan er niets in veranderen en ziet niet wat A kocht.'::text;

    -- 6. B laat een briefje achter in de kamer van A.
    insert into public.world_notes (challenge_id, room_owner, author, kind, body) values (ch, a, b, 'briefje', 'test, alleen voor A') returning id into note;
    ok := false;
    begin
      insert into public.world_notes (challenge_id, room_owner, author, kind, body) values (ch, a, c, 'briefje', 'uit naam van C');
    exception when insufficient_privilege then ok := true;
    end;
    if not ok then raise exception 'FOUT: B kon een briefje schrijven uit naam van C.'; end if;
    log := log || 'OK: B laat een briefje achter, maar niet uit naam van een ander.'::text;

    -- 7. C kan dat briefje niet lezen of weghalen.
    perform pg_temp.als(c);
    select count(*) into n from public.world_notes where id = note;
    if n <> 0 then raise exception 'FOUT: C kan het briefje van B aan A lezen.'; end if;
    delete from public.world_notes where id = note;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FOUT: C kon het briefje weghalen.'; end if;
    log := log || 'OK: C kan het briefje niet lezen of weghalen.'::text;

    -- 8. A leest het briefje en markeert het als gelezen, maar kan de tekst niet veranderen.
    perform pg_temp.als(a);
    select count(*) into n from public.world_notes where id = note;
    if n <> 1 then raise exception 'FOUT: A kan het briefje in de eigen kamer niet lezen.'; end if;
    update public.world_notes set read_at = now() where id = note;
    ok := false;
    begin
      update public.world_notes set body = 'veranderd door A' where id = note;
    exception when insufficient_privilege then ok := true;
    end;
    if not ok then raise exception 'FOUT: A kon de tekst van het briefje van B veranderen.'; end if;
    log := log || 'OK: A leest het briefje en markeert het als gelezen, maar kan de tekst niet veranderen.'::text;

    log := log || 'Alle controles geslaagd.'::text;
    raise exception 'terugdraaien';
  exception when others then
    if sqlerrm <> 'terugdraaien' then
      log := log || (case when sqlerrm like 'FOUT%' then sqlerrm else 'FOUT: de test liep vast: ' || sqlerrm end);
    end if;
  end;
  execute 'reset role';
  insert into kamertest select i, log[i] from generate_subscripts(log, 1) as i;
end;
$$;

select uitkomst from kamertest order by stap;
