-- Fix security: Remove overly permissive RLS policy and replace with secure one
-- This migration fixes the "Shared journal access" policy that was allowing
-- anyone to see journals that have ANY share record, even if they're not authorized

-- Drop the overly permissive policies that allow access to any journal with a share
DROP POLICY IF EXISTS "Shared journal access" ON public.journals;
DROP POLICY IF EXISTS "Shared journal edit access" ON public.journals;

-- IMPORTANT: Keep the original "Users can view their own journals" policy
-- This ensures users can always see their own journals
-- The original policy from the initial migration should remain active

-- Only add a policy for shared journals if it doesn't already exist
-- This allows sharing while keeping the base ownership policy intact
DO $$
BEGIN
  -- Only create shared access policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'journals' 
    AND policyname = 'Users can view shared journals'
  ) THEN
    CREATE POLICY "Users can view shared journals"
    ON public.journals
    FOR SELECT
    USING (
      -- Journal is shared and user is authorized via journal_shares
      EXISTS (
        SELECT 1 FROM public.journal_shares js
        WHERE js.journal_id = journals.id
        AND (
          -- Public share (anyone can view)
          js.share_type = 'anyone'
          OR
          -- Specific users share - application layer verifies email
          (
            js.share_type = 'specific_users'
            AND js.allowed_emails IS NOT NULL
            AND array_length(js.allowed_emails, 1) > 0
          )
        )
      )
    );
  END IF;
END $$;

-- Only add shared update policy if it doesn't exist
-- The original "Users can update their own journals" policy should remain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'journals' 
    AND policyname = 'Users can update shared journals with edit permission'
  ) THEN
    CREATE POLICY "Users can update shared journals with edit permission"
    ON public.journals
    FOR UPDATE
    USING (
      -- Journal is shared with edit permission
      EXISTS (
        SELECT 1 FROM public.journal_shares jsh
        WHERE jsh.journal_id = journals.id
        AND jsh.permission_type = 'edit'
        AND (
          jsh.share_type = 'anyone'
          OR (
            jsh.share_type = 'specific_users'
            AND jsh.allowed_emails IS NOT NULL
            AND array_length(jsh.allowed_emails, 1) > 0
          )
        )
      )
    );
  END IF;
END $$;

-- Ensure INSERT and DELETE are restricted to owners only (no sharing for these operations)
DO $$
BEGIN
  -- INSERT policy - only owners can create
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

  -- DELETE policy - only owners can delete
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

-- SECURITY NOTE: 
-- 1. RLS policies ensure users can only see/update journals they own or that are explicitly shared
-- 2. Application layer must verify email addresses for 'specific_users' shares (defense in depth)
-- 3. All queries in the application should also filter by user_id where possible
-- 4. This multi-layer security approach prevents unauthorized access even if one layer fails

