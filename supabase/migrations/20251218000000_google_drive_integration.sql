-- Create table for storing Google Drive OAuth tokens
CREATE TABLE IF NOT EXISTS google_drive_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamptz,
  google_email text,
  google_user_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_drive_tokens_user_id ON google_drive_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own tokens
CREATE POLICY "Users can view their own Google Drive tokens"
  ON google_drive_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google Drive tokens"
  ON google_drive_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Drive tokens"
  ON google_drive_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Drive tokens"
  ON google_drive_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Create table for caching Google Drive file metadata (for faster search)
CREATE TABLE IF NOT EXISTS google_drive_files_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_id text NOT NULL,
  file_name text,
  mime_type text,
  modified_time timestamptz,
  file_content text, -- extracted text content
  web_view_link text,
  icon_link text,
  size bigint,
  indexed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, file_id)
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_google_drive_files_cache_user_id ON google_drive_files_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_google_drive_files_cache_file_name ON google_drive_files_cache(user_id, file_name);
CREATE INDEX IF NOT EXISTS idx_google_drive_files_cache_content ON google_drive_files_cache USING gin(to_tsvector('english', file_content));

-- Enable Row Level Security
ALTER TABLE google_drive_files_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cache
CREATE POLICY "Users can view their own cached files"
  ON google_drive_files_cache
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cached files"
  ON google_drive_files_cache
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cached files"
  ON google_drive_files_cache
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cached files"
  ON google_drive_files_cache
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_drive_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_google_drive_tokens_timestamp
  BEFORE UPDATE ON google_drive_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_drive_tokens_updated_at();

