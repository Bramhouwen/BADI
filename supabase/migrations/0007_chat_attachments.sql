-- ---------------------------------------------------------------------------
-- 0007: Chat attachments and references
--
-- A message can carry one attachment: an uploaded image or file (private
-- bucket "chat", path {challenge}/{user}/file), or a reference to a recipe
-- in the Kitchen or a photo on the Wall. Text becomes optional when there
-- is an attachment.
-- ---------------------------------------------------------------------------

alter table public.squad_messages
  add column attachment_type text check (attachment_type in ('image', 'file', 'recipe', 'post')),
  add column attachment_path text check (attachment_path is null or char_length(attachment_path) <= 300),
  add column attachment_name text check (attachment_name is null or char_length(attachment_name) <= 200),
  add column ref_id uuid;

alter table public.squad_messages drop constraint squad_messages_body_check;
alter table public.squad_messages add constraint squad_messages_body_check
  check (char_length(btrim(body)) <= 1000 and (char_length(btrim(body)) > 0 or attachment_type is not null));
alter table public.squad_messages add constraint squad_messages_attachment_check
  check (
    attachment_type is null
    or (attachment_type in ('image', 'file') and attachment_path is not null)
    or (attachment_type in ('recipe', 'post') and ref_id is not null)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "chat media: members read" on storage.objects
  for select to authenticated using (
    bucket_id = 'chat' and public.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "chat media: owners upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "chat media: owners delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'chat' and (storage.foldername(name))[2] = auth.uid()::text
  );
