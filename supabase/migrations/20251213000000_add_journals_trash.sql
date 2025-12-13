-- Add soft-delete support for journals
ALTER TABLE public.journals
ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS journals_user_trashed_at_idx
ON public.journals (user_id, trashed_at);

-- Purge helper (optional to call from cron / clients)
CREATE OR REPLACE FUNCTION public.purge_trashed_journals()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.journals
  WHERE trashed_at IS NOT NULL
    AND trashed_at < now() - interval '30 days';
$$;

-- Best-effort daily schedule (requires pg_cron). If pg_cron is unavailable, this section can be removed.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if extension isn't available in this environment.
    RETURN;
  END;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_trashed_journals') THEN
    PERFORM cron.schedule(
      'purge_trashed_journals',
      '0 3 * * *',
      $$select public.purge_trashed_journals();$$
    );
  END IF;
END $$;



