-- Add share_id column to journals table for sharing functionality
ALTER TABLE journals ADD COLUMN IF NOT EXISTS share_id uuid;

-- Create index for faster lookups on share_id
CREATE INDEX IF NOT EXISTS idx_journals_share_id ON journals(share_id);

-- Add constraint to ensure share_id is unique when present
ALTER TABLE journals ADD CONSTRAINT journals_share_id_unique
  EXCLUDE (share_id WITH =) WHERE (share_id IS NOT NULL);


