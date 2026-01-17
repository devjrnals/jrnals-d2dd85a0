-- Emergency fix: Ensure users can view their own journals
-- This ensures the original policy exists and works correctly

-- Drop any conflicting overly permissive policies
DROP POLICY IF EXISTS "Shared journal access" ON public.journals;
DROP POLICY IF EXISTS "Shared journal edit access" ON public.journals;
DROP POLICY IF EXISTS "Users can view their own journals or authorized shared journals" ON public.journals;
DROP POLICY IF EXISTS "Users can update their own journals or authorized shared journals with edit permission" ON public.journals;

-- Ensure the original ownership policy exists (this is the critical one)
DO $$
BEGIN
  -- Drop and recreate to ensure it's correct
  DROP POLICY IF EXISTS "Users can view their own journals" ON public.journals;
  
  CREATE POLICY "Users can view their own journals"
  ON public.journals FOR SELECT
  USING (auth.uid() = user_id);
END $$;

-- Ensure UPDATE policy exists for owners
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update their own journals" ON public.journals;
  
  CREATE POLICY "Users can update their own journals"
  ON public.journals FOR UPDATE
  USING (auth.uid() = user_id);
END $$;

-- Ensure INSERT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'journals' 
    AND policyname = 'Users can create their own journals'
  ) THEN
    CREATE POLICY "Users can create their own journals"
    ON public.journals FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure DELETE policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'journals' 
    AND policyname = 'Users can delete their own journals'
  ) THEN
    CREATE POLICY "Users can delete their own journals"
    ON public.journals FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

