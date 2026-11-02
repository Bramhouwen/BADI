-- 0009: Nothing is mandatory when sharing a recipe. The photo becomes optional;
-- the app fills in a title when none is given.
alter table public.recipes alter column image_path drop not null;
