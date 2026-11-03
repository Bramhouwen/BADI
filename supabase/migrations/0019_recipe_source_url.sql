-- ---------------------------------------------------------------------------
-- 0019: link to the original of an imported recipe
--
-- recipes.source_url holds the recipe site or TikTok a recipe was imported
-- from (or that the author typed in); the recipe page links to it.
-- ---------------------------------------------------------------------------

alter table public.recipes add column source_url text;
alter table public.recipes add constraint recipes_source_url_check
  check (source_url is null or (char_length(source_url) <= 500 and source_url ~* '^https?://'));
