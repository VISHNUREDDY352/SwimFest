-- ============================================================
-- SwimFest — races offered per meet
-- Stores the races an organizer switched on in Create a meet,
-- e.g. {'50m Freestyle','100m Backstroke'}. Run once in the
-- Supabase SQL editor.
-- ============================================================

alter table public.tournaments
  add column if not exists events_offered text[];
