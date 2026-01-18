# Google Identity Services (GSI) Authentication Setup

## Overview
This application uses Google Identity Services (GSI) for Google authentication instead of the traditional OAuth flow. GSI provides a modern, secure sign-in experience.

## Implementation Status

### ✅ Completed
- GSI script added to `index.html`
- Auth component updated to use GSI (`src/pages/Auth.tsx`)
- Frontend configured to use Client ID: `796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com`

### ⚠️ Required Configuration

#### 1. Update Supabase Edge Functions Environment Variables

**Location**: Supabase Dashboard > Project Settings > Edge Functions > Secrets

Update the following environment variable:

```
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
```

**⚠️ SECURITY WARNING**: Replace `YOUR_GOOGLE_CLIENT_SECRET_HERE` with your actual Google Client Secret from Google Cloud Console. Never commit real secrets to version control.

**Important**: After updating the secret, redeploy any Edge Functions that use it (if applicable).

#### 2. Verify Supabase Auth Configuration

**Location**: Supabase Dashboard > Authentication > Providers > Google

- ✅ Ensure Google provider is **Enabled**
- ✅ **Client ID (for OAuth)**: `796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com`
- ✅ **Client Secret (for OAuth)**: `YOUR_CLIENT_SECRET_HERE` (store in Supabase Edge Functions secrets, not in code)
- ✅ Verify **Authorized redirect URIs** in Google Cloud Console includes:
  - `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback`

#### 3. Google Cloud Console Configuration

Verify the following in [Google Cloud Console](https://console.cloud.google.com/):

1. **OAuth 2.0 Client ID Configuration**:
   - Client ID: `796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com`
   - Client Secret: `YOUR_CLIENT_SECRET_HERE` (retrieve from Google Cloud Console and store in Supabase Edge Functions secrets)

2. **Authorized JavaScript origins**:
   - `http://localhost:3000` (for development)
   - Your production domain (if applicable)

3. **Authorized redirect URIs**:
   - `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback`

## How It Works

1. User clicks "Continue with Google" button (rendered by GSI)
2. GSI handles Google sign-in and returns an ID token
3. Frontend sends the ID token to Supabase using `signInWithIdToken`
4. Supabase verifies the token with Google and creates/updates the user session
5. User is redirected to the dashboard

## Testing

After configuration, test:
- ✅ Sign-in with existing Google account (login flow)
- ✅ Sign-in with new Google account (sign-up flow)
- ✅ Error handling for authentication failures
- ✅ Redirect to dashboard after successful authentication

## Troubleshooting

### Button doesn't render
- Check browser console for GSI script loading errors
- Verify Client ID is correct
- Ensure GSI script is loaded (check Network tab)

### Authentication fails
- Verify Google provider is enabled in Supabase Dashboard
- Check that Client ID and Secret match in both Supabase and Google Cloud Console
- Verify redirect URI is correctly configured in Google Cloud Console
- Check Supabase logs for detailed error messages

### "Missing Google OAuth configuration" error
- Ensure `GOOGLE_CLIENT_SECRET` is set in Supabase Edge Functions environment
- Verify Client ID is accessible in frontend code

