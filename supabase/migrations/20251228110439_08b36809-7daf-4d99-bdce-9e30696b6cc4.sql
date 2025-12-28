-- Fix admin_data RLS policies
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all operations on admin_data" ON public.admin_data;

-- Create restrictive admin-only policies for admin_data
CREATE POLICY "Admins can view admin_data"
ON public.admin_data
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin_data"
ON public.admin_data
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete admin_data"
ON public.admin_data
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert admin_data"
ON public.admin_data
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix increment functions with SECURITY DEFINER
-- These functions need to bypass RLS but should be rate-limited by session
CREATE OR REPLACE FUNCTION public.increment_visitor_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_data
  SET value = (value::int + 1)::text::jsonb, updated_at = NOW()
  WHERE key = 'visitor_count';
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_accounts_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_data
  SET value = (value::int + 1)::text::jsonb, updated_at = NOW()
  WHERE key = 'accounts_signed_up';
END;
$$;

-- Allow authenticated users to call increment functions (they should implement client-side rate limiting)
-- The functions use SECURITY DEFINER so they can bypass RLS
REVOKE EXECUTE ON FUNCTION public.increment_visitor_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_visitor_count() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_accounts_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_accounts_count() TO authenticated;