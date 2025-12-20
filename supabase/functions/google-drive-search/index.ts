import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client to verify the user
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's Google Drive tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_drive_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Google Drive not connected. Please connect your Google Drive first.');
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.token_expiry);
    const now = new Date();

    if (tokenExpiry <= now) {
      // Token is expired, refresh it
      const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
      const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update token in database
      const newExpiry = new Date();
      newExpiry.setSeconds(newExpiry.getSeconds() + refreshData.expires_in);

      await supabase
        .from('google_drive_tokens')
        .update({
          access_token: accessToken,
          token_expiry: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    // Parse request body to get search query
    const { query, maxResults = 10 } = await req.json();

    if (!query) {
      throw new Error('Search query is required');
    }

    // Search Google Drive
    const searchParams = new URLSearchParams({
      q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed=false`,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink, iconLink, size)',
      pageSize: maxResults.toString(),
    });

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!driveResponse.ok) {
      const errorData = await driveResponse.text();
      throw new Error(`Google Drive API error: ${errorData}`);
    }

    const driveData = await driveResponse.json();

    // Optionally cache the results
    if (driveData.files && driveData.files.length > 0) {
      const cacheRecords = driveData.files.map((file: any) => ({
        user_id: user.id,
        file_id: file.id,
        file_name: file.name,
        mime_type: file.mimeType,
        modified_time: file.modifiedTime,
        web_view_link: file.webViewLink,
        icon_link: file.iconLink,
        size: file.size ? parseInt(file.size) : null,
        indexed_at: new Date().toISOString(),
      }));

      // Upsert cache records (ignore errors as this is optional)
      try {
        await supabase
          .from('google_drive_files_cache')
          .upsert(cacheRecords, { onConflict: 'user_id,file_id' });
      } catch {
        // Ignore cache errors
      }
    }

    return new Response(
      JSON.stringify({ 
        files: driveData.files || [],
        query,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

