-- Create chat isolation tables
-- Each journal gets its own isolated chat thread

-- Create chats table - one chat per journal
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    journal_id UUID NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(journal_id) -- One chat per journal
);

-- Create chat_messages table - messages scoped to specific chats
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    files JSONB, -- Store file attachments as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_journal_id ON public.chats(journal_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing localStorage data to database (optional)
-- This would require a migration script to read existing localStorage and create chats/messages
-- For now, we'll start fresh with new chat isolation

-- Enable RLS (Row Level Security)
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access their own journal chats
CREATE POLICY "Users can view their own chats" ON public.chats
    FOR SELECT USING (
        journal_id IN (
            SELECT id FROM public.journals WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own chats" ON public.chats
    FOR INSERT WITH CHECK (
        journal_id IN (
            SELECT id FROM public.journals WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own chats" ON public.chats
    FOR UPDATE USING (
        journal_id IN (
            SELECT id FROM public.journals WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own chats" ON public.chats
    FOR DELETE USING (
        journal_id IN (
            SELECT id FROM public.journals WHERE user_id = auth.uid()
        )
    );

-- Chat messages policies
CREATE POLICY "Users can view their own chat messages" ON public.chat_messages
    FOR SELECT USING (
        chat_id IN (
            SELECT c.id FROM public.chats c
            JOIN public.journals j ON c.journal_id = j.id
            WHERE j.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own chat messages" ON public.chat_messages
    FOR INSERT WITH CHECK (
        chat_id IN (
            SELECT c.id FROM public.chats c
            JOIN public.journals j ON c.journal_id = j.id
            WHERE j.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own chat messages" ON public.chat_messages
    FOR UPDATE USING (
        chat_id IN (
            SELECT c.id FROM public.chats c
            JOIN public.journals j ON c.journal_id = j.id
            WHERE j.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own chat messages" ON public.chat_messages
    FOR DELETE USING (
        chat_id IN (
            SELECT c.id FROM public.chats c
            JOIN public.journals j ON c.journal_id = j.id
            WHERE j.user_id = auth.uid()
        )
    );
