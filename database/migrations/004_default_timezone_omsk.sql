-- ============================================================================
-- CALORIA — default timezone: Asia/Omsk (UTC+6)
--
-- Run this if the database was created before the default timezone changed.
-- It only changes defaults for FUTURE rows; existing user preferences are kept.
-- Safe to re-run.
-- ============================================================================

alter table public.users
  alter column timezone set default 'Asia/Omsk';

alter table public.reminder_settings
  alter column timezone set default 'Asia/Omsk';

do $$
begin
  raise notice 'CALORIA default timezone is now Asia/Omsk.';
end $$;