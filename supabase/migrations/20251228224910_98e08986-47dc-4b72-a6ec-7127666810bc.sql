-- Drop the existing SELECT policy and recreate it to ensure it's admin-only
DROP POLICY IF EXISTS "Admins can view all emails" ON public.coming_soon_emails;

-- Recreate the policy as RESTRICTIVE with proper admin check
CREATE POLICY "Admins can view all emails" 
ON public.coming_soon_emails 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));