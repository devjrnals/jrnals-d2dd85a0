-- Create metric tracking table for server-side rate limiting
CREATE TABLE IF NOT EXISTS public.metric_tracking (
  user_id uuid NOT NULL,
  metric_type text NOT NULL,
  last_increment timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric_type)
);

-- Enable RLS on metric_tracking
ALTER TABLE public.metric_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see/update their own tracking records
CREATE POLICY "Users can view their own metric tracking"
ON public.metric_tracking
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metric tracking"
ON public.metric_tracking
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metric tracking"
ON public.metric_tracking
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Update increment_visitor_count with server-side rate limiting
-- Only allows one increment per user per 24 hours
CREATE OR REPLACE FUNCTION public.increment_visitor_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_tracked timestamptz;
BEGIN
  -- Only authenticated users can call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check when user last incremented this metric
  SELECT last_increment INTO last_tracked
  FROM metric_tracking
  WHERE user_id = auth.uid() AND metric_type = 'visitor';
  
  -- Only increment once per day per user
  IF last_tracked IS NULL OR last_tracked < NOW() - INTERVAL '24 hours' THEN
    -- Update the visitor count
    UPDATE public.admin_data
    SET value = (value::int + 1)::text::jsonb, updated_at = NOW()
    WHERE key = 'visitor_count';
    
    -- Record the tracking
    INSERT INTO metric_tracking (user_id, metric_type, last_increment)
    VALUES (auth.uid(), 'visitor', NOW())
    ON CONFLICT (user_id, metric_type) 
    DO UPDATE SET last_increment = NOW();
  END IF;
END;
$$;

-- Update increment_accounts_count with server-side rate limiting
-- Only allows one increment per user ever (account signup is one-time)
CREATE OR REPLACE FUNCTION public.increment_accounts_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_tracked boolean;
BEGIN
  -- Only authenticated users can call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if this user has already been counted
  SELECT EXISTS(
    SELECT 1 FROM metric_tracking
    WHERE user_id = auth.uid() AND metric_type = 'account_signup'
  ) INTO already_tracked;
  
  -- Only increment once per user ever
  IF NOT already_tracked THEN
    -- Update the accounts count
    UPDATE public.admin_data
    SET value = (value::int + 1)::text::jsonb, updated_at = NOW()
    WHERE key = 'accounts_signed_up';
    
    -- Record the tracking (prevents duplicate counting)
    INSERT INTO metric_tracking (user_id, metric_type, last_increment)
    VALUES (auth.uid(), 'account_signup', NOW())
    ON CONFLICT (user_id, metric_type) DO NOTHING;
  END IF;
END;
$$;