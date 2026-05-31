-- Reload PostgREST schema cache so mod_staff is visible to the dashboard API.
-- Safe to re-run any time after creating mod_staff.

notify pgrst, 'reload schema';
