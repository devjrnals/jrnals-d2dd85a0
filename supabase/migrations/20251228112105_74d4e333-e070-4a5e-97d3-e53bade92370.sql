-- Create journal_shares table with secure random share_id
CREATE TABLE IF NOT EXISTS public.journal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  share_type text NOT NULL DEFAULT 'anyone' CHECK (share_type IN ('anyone', 'specific_users')),
  permission_type text NOT NULL DEFAULT 'view' CHECK (permission_type IN ('view', 'edit')),
  allowed_emails text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint on journal_id + created_by (one share per journal per user)
CREATE UNIQUE INDEX IF NOT EXISTS journal_shares_journal_created_by_idx 
  ON public.journal_shares(journal_id, created_by);

-- Enable RLS
ALTER TABLE public.journal_shares ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own shares
CREATE POLICY "Owners can manage their shares"
ON public.journal_shares
FOR ALL
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Anyone can read shares (needed for public share links)
-- The application verifies access based on share_type and allowed_emails
CREATE POLICY "Anyone can read shares for public access verification"
ON public.journal_shares
FOR SELECT
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_journal_shares_updated_at
  BEFORE UPDATE ON public.journal_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create oauth_states table for secure OAuth state validation
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS oauth_states_token_idx ON public.oauth_states(state_token);
CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON public.oauth_states(expires_at);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can create their own state tokens
CREATE POLICY "Users can create their own OAuth states"
ON public.oauth_states
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own OAuth states
CREATE POLICY "Users can view their own OAuth states"
ON public.oauth_states
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow deletion by owner
CREATE POLICY "Users can delete their own OAuth states"
ON public.oauth_states
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add RLS policy for journals table to allow shared access
CREATE POLICY "Shared journal access"
ON public.journals
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.journal_shares js
    WHERE js.journal_id = journals.id
  )
);

-- Add RLS policy for journals table to allow shared edit access
CREATE POLICY "Shared journal edit access"
ON public.journals
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.journal_shares js
    WHERE js.journal_id = journals.id
    AND js.permission_type = 'edit'
  )
);