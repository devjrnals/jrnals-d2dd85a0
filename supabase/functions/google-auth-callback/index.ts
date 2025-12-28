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
    // Get Google OAuth credentials from environment
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI');
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      throw new Error('Missing Google OAuth configuration');
    }

    // Parse request body
    const { code, state } = await req.json();
    
    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    // SECURITY: Validate state token format (must be valid UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(state)) {
      throw new Error('Invalid state parameter format');
    }

    // Create Supabase client with service role to validate state token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Validate state token from database and get associated user_id
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id, expires_at')
      .eq('state_token', state)
      .single();

    if (stateError || !stateData) {
      console.error('State validation failed:', stateError);
      throw new Error('Invalid or expired OAuth state. Please try connecting again.');
    }

    // SECURITY: Check if state token has expired
    const expiresAt = new Date(stateData.expires_at);
    if (expiresAt < new Date()) {
      // Clean up expired state
      await supabase.from('oauth_states').delete().eq('state_token', state);
      throw new Error('OAuth session expired. Please try connecting again.');
    }

    // Get the verified user_id from the state token
    const userId = stateData.user_id;

    // SECURITY: Delete the state token immediately (one-time use)
    await supabase.from('oauth_states').delete().eq('state_token', state);

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      throw new Error('Failed to obtain tokens');
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json();

    // Calculate token expiry
    const tokenExpiry = new Date();
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expires_in);

    // Insert or update tokens using the validated user_id from state token
    const { error: dbError } = await supabase
      .from('google_drive_tokens')
      .upsert({
        user_id: userId, // SECURITY: Use validated user_id from state token, not from request
        access_token,
        refresh_token,
        token_expiry: tokenExpiry.toISOString(),
        google_email: userInfo.email,
        google_user_id: userInfo.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Google Drive connected successfully',
        email: userInfo.email,
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
