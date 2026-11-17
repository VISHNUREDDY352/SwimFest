-- ============================================================
-- SwimFest — swimmer documents (age proof + signed undertaking)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run more than once.
--
-- Parents upload two documents when they register a swimmer:
--   * age proof: birth certificate or Aadhaar card
--   * the non-medalist undertaking form, signed by the coach or parent
-- Admin / Super Admin open them from the approval queues.
--
-- The bucket is PRIVATE (Aadhaar is personal data). Files are read
-- through short-lived signed links, never a public URL.
--   * a parent can upload and read files in their own folder (<user id>/...)
--   * meet staff (Admin, Organizer, Super Admin) can read every file
-- Needs public.is_meet_staff() from staff_manage_swimmers.sql.
-- ============================================================

-- 1. Where each swimmer's files are stored (storage paths, not URLs)
alter table public.swimmers add column if not exists age_proof_path  text;
alter table public.swimmers add column if not exists undertaking_path text;

-- 2. Private bucket: 5 MB per file, photos or PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('swimmer-docs', 'swimmer-docs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Storage policies
drop policy if exists "swimmer docs upload own folder" on storage.objects;
drop policy if exists "swimmer docs replace own folder" on storage.objects;
drop policy if exists "swimmer docs read own or staff"  on storage.objects;

create policy "swimmer docs upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'swimmer-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "swimmer docs replace own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'swimmer-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "swimmer docs read own or staff" on storage.objects
  for select to authenticated
  using (bucket_id = 'swimmer-docs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_meet_staff()));
