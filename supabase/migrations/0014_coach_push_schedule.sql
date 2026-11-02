-- ---------------------------------------------------------------------------
-- 0014: Schedule Baddy's pushes at 07:00 and 21:00 (Europe/Amsterdam)
--
-- pg_cron runs in UTC, so each job fires on both possible UTC hours; the app
-- only sends when it is 07:00 or 21:00 in Amsterdam, which keeps this correct
-- across summer and winter time. The token lives only in Vault and in the
-- request header; the app checks it through coach_push_claim().
-- If the first two lines fail, enable pg_cron and pg_net under Database,
-- Extensions in the Supabase dashboard and run this file again.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'badi_coach_cron') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'badi_coach_cron', 'Token for the BADI coach push schedule');
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname in ('badi-coach-morning', 'badi-coach-evening');

select cron.schedule(
  'badi-coach-morning',
  '0 5,6 * * *',
  $cmd$
  select net.http_get(
    url := 'https://badi-mu.vercel.app/api/cron/coach',
    params := '{"slot": "morning"}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'badi_coach_cron')),
    timeout_milliseconds := 30000
  );
  $cmd$
);

select cron.schedule(
  'badi-coach-evening',
  '0 19,20 * * *',
  $cmd$
  select net.http_get(
    url := 'https://badi-mu.vercel.app/api/cron/coach',
    params := '{"slot": "evening"}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'badi_coach_cron')),
    timeout_milliseconds := 30000
  );
  $cmd$
);
