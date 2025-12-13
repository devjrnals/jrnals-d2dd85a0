-- Create storage bucket for app assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true);

-- Allow public read access to app assets
CREATE POLICY "Public read access for app assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'app-assets');

-- Allow authenticated users to upload app assets (for admin purposes)
CREATE POLICY "Authenticated users can upload app assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'app-assets' AND auth.role() = 'authenticated');