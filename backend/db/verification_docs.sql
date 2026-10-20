-- ============================================================
-- SwimFest — Verification document support
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Adds a document_url column to academies + coaches so the file
-- an Event Manager uploads (registration doc / certification) can
-- be stored and later opened by the Super Admin for verification.
--
-- Files themselves live in a Supabase Storage bucket named
-- 'verification-docs' (created below with public read).
-- ============================================================

-- 1. Columns to hold the uploaded file's public URL
alter table academies add column if not exists document_url text;
alter table coaches   add column if not exists document_url text;

-- 2. Storage bucket for the uploaded documents
--    (public so the Super Admin can open the file via its URL)
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', true)
on conflict (id) do nothing;

-- 3. Storage policies
--    - Authenticated users (Event Managers) can upload
--    - Anyone can read (Super Admin views via public URL)
drop policy if exists "verification docs upload" on storage.objects;
create policy "verification docs upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification-docs');

drop policy if exists "verification docs read" on storage.objects;
create policy "verification docs read" on storage.objects
  for select using (bucket_id = 'verification-docs');

-- ============================================================
-- Done. Event Managers can now attach a file when submitting an
-- academy/coach; the URL is saved on the row and the Super Admin
-- verification queue shows a "View Document" button.
-- ============================================================
