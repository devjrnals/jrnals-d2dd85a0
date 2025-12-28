-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Only admins can manage roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drop the permissive policy on coming_soon_emails
DROP POLICY IF EXISTS "Allow all operations on coming_soon_emails" ON public.coming_soon_emails;

-- Create restrictive policies for coming_soon_emails
-- Allow public insert (for email signups) but no read/update/delete
CREATE POLICY "Anyone can submit their email"
ON public.coming_soon_emails
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can view emails
CREATE POLICY "Admins can view all emails"
ON public.coming_soon_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete emails
CREATE POLICY "Admins can delete emails"
ON public.coming_soon_emails
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));