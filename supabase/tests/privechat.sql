-- ---------------------------------------------------------------------------
-- Privacytest privéberichten (BADI Wereld, fase 3)
--
-- Draai dit in de SQL Editor van Supabase. Het script:
--   1. neemt drie leden van dezelfde groep: A, B en C;
--   2. laat A een privébericht naar B sturen, ingelogd als A;
--   3. laat C (een derde lid) proberen dat bericht te lezen, te wijzigen,
--      te verwijderen, uit naam van A te sturen, de leesstatus te zien en er
--      een reactie onder te zetten.
-- Het testbericht wordt altijd weer teruggedraaid: er blijft niets achter en
-- er gaat geen melding of pushbericht uit.
--
-- Uitkomst: een tabel met per stap "OK: ..." of "FOUT: ...". De laatste regel
-- is "Alle controles geslaagd" als alles goed is.
-- ---------------------------------------------------------------------------

create temp table if not exists privacytest (stap int, uitkomst text);
truncate privacytest;

do $$
declare
  log text[] := '{}';
  ch uuid;
  members uuid[];
  a uuid;
  b uuid;
  c uuid;
  msg uuid;
  n int;
  blocked boolean;
begin
  -- Alles hierbinnen wordt aan het eind teruggedraaid (een subtransactie die we bewust laten mislukken).
  begin
    select challenge_id into ch from public.memberships group by challenge_id having count(*) >= 3 order by count(*) desc limit 1;
    if ch is null then raise exception 'FOUT: geen groep met minstens drie leden gevonden.'; end if;
    select array_agg(user_id order by joined_at) into members from public.memberships where challenge_id = ch;
    a := members[1];
    b := members[2];
    c := members[3];

    -- 1. A stuurt B een privébericht, zoals de app dat doet (rol "authenticated", A in het token).
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    execute 'set local role authenticated';
    insert into public.squad_messages (challenge_id, user_id, recipient_id, body)
      values (ch, a, b, 'privacytest: alleen voor B')
      returning id into msg;
    execute 'reset role';
    log := log || 'OK: A heeft B een privébericht gestuurd (wordt teruggedraaid).'::text;

    -- 2. B kan het lezen: controle dat de test zelf klopt.
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', b::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.squad_messages where id = msg;
    execute 'reset role';
    if n <> 1 then raise exception 'FOUT: B kan het eigen privébericht niet lezen. De test zelf klopt niet.'; end if;
    log := log || 'OK: B (de ontvanger) kan het bericht lezen.'::text;

    -- 3. Vanaf hier is C ingelogd: een derde lid van dezelfde groep.
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', c::text, true);
    execute 'set local role authenticated';

    select count(*) into n from public.squad_messages where id = msg;
    if n <> 0 then raise exception 'FOUT: C kan het privébericht van A aan B lezen.'; end if;
    log := log || 'OK: C kan het bericht niet lezen.'::text;

    select count(*) into n from public.squad_messages where recipient_id is not null and c <> user_id and c <> recipient_id;
    if n <> 0 then raise exception 'FOUT: C ziet % privéberichten van anderen.', n; end if;
    log := log || 'OK: C ziet geen enkel privébericht van anderen.'::text;

    update public.squad_messages set body = 'gewijzigd door C' where id = msg;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FOUT: C kan het bericht wijzigen.'; end if;
    log := log || 'OK: C kan het bericht niet wijzigen.'::text;

    delete from public.squad_messages where id = msg;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FOUT: C kan het bericht verwijderen.'; end if;
    log := log || 'OK: C kan het bericht niet verwijderen.'::text;

    blocked := false;
    begin
      insert into public.squad_messages (challenge_id, user_id, recipient_id, body) values (ch, a, b, 'nep, uit naam van A');
    exception when insufficient_privilege or check_violation then
      blocked := true;
    end;
    if not blocked then raise exception 'FOUT: C kan een bericht sturen uit naam van A.'; end if;
    log := log || 'OK: C kan geen bericht sturen uit naam van A.'::text;

    select count(*) into n from public.direct_reads where c <> user_id and c <> peer_id;
    if n <> 0 then raise exception 'FOUT: C ziet de leesstatus van gesprekken van anderen.'; end if;
    log := log || 'OK: C ziet niet wanneer anderen hun privéberichten lazen.'::text;

    blocked := false;
    begin
      insert into public.message_reactions (message_id, user_id, emoji) values (msg, c, '👀');
    exception when insufficient_privilege or check_violation or foreign_key_violation then
      blocked := true;
    end;
    if not blocked then raise exception 'FOUT: C kan reageren op het privébericht van A aan B.'; end if;
    log := log || 'OK: C kan niet reageren op het bericht.'::text;
    execute 'reset role';

    -- 4. Het bericht is er nog en is niet gewijzigd (bekeken als A).
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.squad_messages where id = msg and body = 'privacytest: alleen voor B';
    execute 'reset role';
    if n <> 1 then raise exception 'FOUT: het bericht is gewijzigd of verdwenen.'; end if;
    log := log || 'OK: het bericht van A is ongewijzigd.'::text;
    log := log || 'Alle controles geslaagd: een derde lid kan een privégesprek niet lezen, wijzigen, verwijderen of namaken.'::text;

    -- Altijd terugdraaien.
    raise exception 'terugdraaien';
  exception when others then
    if sqlerrm <> 'terugdraaien' then
      log := log || (case when sqlerrm like 'FOUT%' then sqlerrm else 'FOUT: de test liep vast: ' || sqlerrm end);
    end if;
  end;

  execute 'reset role';
  insert into privacytest select i, log[i] from generate_subscripts(log, 1) as i;
end;
$$;

select uitkomst from privacytest order by stap;
