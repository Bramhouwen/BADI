-- Fix for Supabase: pgcrypto lives in the "extensions" schema, so the
-- invitation functions need it on their search_path. Safe to run after 0001.

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
