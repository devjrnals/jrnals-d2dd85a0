-- Add per-user theme preference (light/dark) stored on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme TEXT;

ALTER TABLE public.profiles
ALTER COLUMN theme SET DEFAULT 'light';

UPDATE public.profiles
SET theme = 'light'
WHERE theme IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_theme_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_theme_check
    CHECK (theme IN ('light', 'dark'));
  END IF;
END $$;



