-- Force-enable email signups via SQL (in case the dashboard toggle
-- isn't saving). Run in Supabase SQL Editor.
-- Note: on hosted Supabase the auth config is managed by GoTrue and
-- is normally changed via the Dashboard. If this errors, use the
-- Dashboard toggle instead (Authentication → Sign In / Providers →
-- User Signups → "Allow new users to sign up" → Save).

-- This checks the current auth config (read-only diagnostic):
select * from auth.config limit 1;
