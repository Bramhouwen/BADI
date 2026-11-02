-- ---------------------------------------------------------------------------
-- 0017: AI photos for recipes without a photo
--
-- recipes.image_ai marks a generated photo (the app shows an "AI-foto" label);
-- an uploaded photo replaces it. image_ai_at feeds a daily cap per squad.
-- set_recipe_ai_image(): any squad member may attach a generated photo to a
-- recipe that has no photo or only an AI photo; the file must sit in the
-- caller's own folder. recipe_ai_quota_left(): photos still allowed today.
-- ---------------------------------------------------------------------------

alter table public.recipes add column image_ai boolean not null default false;
alter table public.recipes add column image_ai_at timestamptz;

create or replace function public.recipe_ai_quota_left()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 40 - count(*))::int
  from public.recipes r
  where r.challenge_id = public.current_challenge_id()
    and r.image_ai_at >= date_trunc('day', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam';
$$;

create or replace function public.set_recipe_ai_image(p_recipe uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe public.recipes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  select * into v_recipe from public.recipes where id = p_recipe;
  if not found or not public.is_member(v_recipe.challenge_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_recipe.image_path is not null and not v_recipe.image_ai then
    raise exception 'HAS_PHOTO' using errcode = '22023';
  end if;
  if p_path is null or p_path not like v_recipe.challenge_id::text || '/' || auth.uid()::text || '/%' then
    raise exception 'INVALID_PATH' using errcode = '22023';
  end if;
  if public.recipe_ai_quota_left() <= 0 then
    raise exception 'AI_LIMIT' using errcode = '53400';
  end if;
  update public.recipes
    set image_path = p_path, image_ai = true, image_ai_at = now()
    where id = p_recipe;
end;
$$;

revoke all on function public.recipe_ai_quota_left() from public, anon;
revoke all on function public.set_recipe_ai_image(uuid, text) from public, anon;
grant execute on function public.recipe_ai_quota_left() to authenticated;
grant execute on function public.set_recipe_ai_image(uuid, text) to authenticated;
