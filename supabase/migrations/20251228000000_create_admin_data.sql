-- Create admin data table for tracking site metrics
CREATE TABLE IF NOT EXISTS public.admin_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create coming soon emails table
CREATE TABLE IF NOT EXISTS public.coming_soon_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insert default admin data
INSERT INTO public.admin_data (key, value) VALUES
    ('visitor_count', '0'::jsonb),
    ('accounts_signed_up', '0'::jsonb),
    ('revenue', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.admin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coming_soon_emails ENABLE ROW LEVEL SECURITY;

-- Create policies - only allow admin access (we'll handle this in the application)
CREATE POLICY "Allow all operations on admin_data" ON public.admin_data
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on coming_soon_emails" ON public.coming_soon_emails
    FOR ALL USING (true);

-- Create function to increment visitor count
CREATE OR REPLACE FUNCTION increment_visitor_count()
RETURNS void AS $$
BEGIN
    UPDATE public.admin_data
    SET value = (value::int + 1)::text::jsonb, updated_at = NOW()
    WHERE key = 'visitor_count';
END;
$$ LANGUAGE plpgsql;

-- Create function to increment accounts count
CREATE OR REPLACE FUNCTION increment_accounts_count()
RETURNS void AS $$
BEGIN
    UPDATE public.admin_data
    SET value = (value::int + 1)::text::jsonb, updated_at = NOW()
    WHERE key = 'accounts_signed_up';
END;
$$ LANGUAGE plpgsql;
