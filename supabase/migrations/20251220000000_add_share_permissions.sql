-- Create table for storing journal share permissions
CREATE TABLE IF NOT EXISTS journal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid REFERENCES journals(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_type text NOT NULL CHECK (share_type IN ('anyone', 'specific_users')),
  permission_type text NOT NULL CHECK (permission_type IN ('view', 'edit')),
  allowed_emails text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(journal_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_journal_shares_journal_id ON journal_shares(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_shares_created_by ON journal_shares(created_by);

-- Enable Row Level Security
ALTER TABLE journal_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access shares for journals they own
CREATE POLICY "Users can view shares for their own journals"
  ON journal_shares
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create shares for their own journals"
  ON journal_shares
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update shares for their own journals"
  ON journal_shares
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete shares for their own journals"
  ON journal_shares
  FOR DELETE
  USING (created_by = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_journal_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_journal_shares_timestamp
  BEFORE UPDATE ON journal_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_shares_updated_at();




