-- URGENT FIX: Run this in your Supabase SQL Editor to fix journals not showing
-- This ensures users can view their own journals

-- Drop any problematic policies
DROP POLICY IF EXISTS "Shared journal access" ON public.journals;
DROP POLICY IF EXISTS "Shared journal edit access" ON public.journals;
DROP POLICY IF EXISTS "Users can view their own journals or authorized shared journals" ON public.journals;
DROP POLICY IF EXISTS "Users can update their own journals or authorized shared journals with edit permission" ON public.journals;
DROP POLICY IF EXISTS "Users can view shared journals" ON public.journals;
DROP POLICY IF EXISTS "Users can update shared journals with edit permission" ON public.journals;

-- Ensure the basic ownership policy exists and works
DROP POLICY IF EXISTS "Users can view their own journals" ON public.journals;
CREATE POLICY "Users can view their own journals"
ON public.journals FOR SELECT
USING (auth.uid() = user_id);

-- Ensure UPDATE policy exists
DROP POLICY IF EXISTS "Users can update their own journals" ON public.journals;
CREATE POLICY "Users can update their own journals"
ON public.journals FOR UPDATE
USING (auth.uid() = user_id);

-- Verify policies are correct
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'journals' 
AND schemaname = 'public'
ORDER BY policyname;

