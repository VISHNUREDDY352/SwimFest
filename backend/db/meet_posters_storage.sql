-- ============================================================
-- SwimFest — storage for meet posters
-- A public bucket: anyone can view a poster, but a signed-in user
-- can only upload, replace or delete files in their own folder
-- (<user id>/...). Run once in the Supabase SQL editor.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meet-posters', 'meet-posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meet posters are public"        on storage.objects;
drop policy if exists "upload posters to own folder"   on storage.objects;
drop policy if exists "replace posters in own folder"  on storage.objects;
drop policy if exists "delete posters in own folder"   on storage.objects;

create policy "meet posters are public" on storage.objects
  for select using (bucket_id = 'meet-posters');

create policy "upload posters to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meet-posters' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "replace posters in own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'meet-posters' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete posters in own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meet-posters' and (storage.foldername(name))[1] = auth.uid()::text);
