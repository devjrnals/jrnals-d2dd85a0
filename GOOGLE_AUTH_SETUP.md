# Google Authentication Setup Guide

This guide will help you configure Google OAuth for sign up and login in your application.

## Prerequisites

- A Supabase project
- A Google Cloud Console account

## Step 1: Configure Google OAuth in Google Cloud Console

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create or select a project**

3. **Enable Google+ API** (if not already enabled)
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" or "Google Identity"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - If prompted, configure the OAuth consent screen first:
     - User Type: External (for public use) or Internal (for Google Workspace)
     - App name: Your app name
     - User support email: Your email
     - Developer contact: Your email
     - Click "Save and Continue"
     - Add scopes: `email`, `profile`, `openid`
     - Click "Save and Continue"
     - Add test users if needed (for testing before verification)
     - Click "Save and Continue"
   - Application type: "Web application"
   - Name: "Supabase Auth" (or any name)
   - **Authorized JavaScript origins:**
     - `http://localhost:3000` (for local development)
     - `https://your-production-domain.com` (for production)
   - **Authorized redirect URIs:**
     - `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback` (your Supabase project URL)
     - `http://localhost:3000/auth/callback` (for local development)
   - Click "Create"
   - **Save your Client ID and Client Secret** (you'll need these)

## Step 2: Configure Google OAuth in Supabase Dashboard

1. **Go to your [Supabase Dashboard](https://app.supabase.com)**

2. **Navigate to Authentication > Providers**

3. **Enable Google Provider**
   - Find "Google" in the list of providers
   - Toggle it to "Enabled"

4. **Add Google OAuth Credentials**
   - **Client ID (for OAuth)**: Paste your Google Client ID
   - **Client Secret (for OAuth)**: Paste your Google Client Secret
   - **Authorized Client IDs (optional)**: Leave empty unless you have additional client IDs

5. **Configure Redirect URLs**
   - The redirect URL should be: `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback`
   - Make sure this matches what you added in Google Cloud Console

6. **Save the configuration**

## Step 3: Verify Configuration

1. **Check Redirect URL**
   - In Supabase Dashboard: Authentication > URL Configuration
   - Site URL should be: `http://localhost:3000` (for development) or your production URL
   - Redirect URLs should include:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/dashboard`
     - Your production URLs if applicable

2. **Test the Integration**
   - Start your development server: `npm run dev`
   - Navigate to `/auth`
   - Click "Continue with Google"
   - You should be redirected to Google's sign-in page
   - After signing in, you should be redirected back to your app

## Troubleshooting

### Error: "OAuth provider not enabled"
- Make sure Google provider is enabled in Supabase Dashboard > Authentication > Providers

### Error: "redirect_uri_mismatch"
- Verify that the redirect URI in Google Cloud Console matches exactly: `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback`
- Make sure there are no trailing slashes or extra characters

### Error: "invalid_client"
- Verify your Client ID and Client Secret are correct in Supabase Dashboard
- Make sure you copied them correctly from Google Cloud Console

### Error: "access_denied"
- Check that the OAuth consent screen is properly configured
- If testing, make sure you're using a test user account (if required)

### Session not established after callback
- Check browser console for errors
- Verify the callback route `/auth/callback` is properly configured
- Make sure Supabase client is properly initialized

## Important Notes

- **Never expose your Client Secret** in frontend code
- The Client Secret should only be stored in Supabase Dashboard (server-side)
- For production, update all URLs to use your production domain
- Google OAuth requires HTTPS in production (localhost is exempt)

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

