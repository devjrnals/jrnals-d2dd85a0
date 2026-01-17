-- Add pinned column to journals table
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

-- Create index for faster sorting of pinned journals
CREATE INDEX IF NOT EXISTS idx_journals_pinned ON public.journals(pinned) WHERE pinned = true;

