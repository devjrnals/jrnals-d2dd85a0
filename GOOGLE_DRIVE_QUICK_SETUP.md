# Google Drive Integration - Quick Setup

## ✅ What's Been Configured

1. **Settings Page Updated**: The Google Drive integration component is now active in the Settings page
2. **Client ID Added**: Your OAuth client ID has been added to the documentation

## 🔧 Required Next Steps

### 1. Set Supabase Edge Functions Environment Variables

**CRITICAL:** You must set these environment variables in your Supabase project:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to your project
3. Go to **Edge Functions** → **Secrets**
4. Add the following secrets:

```
GOOGLE_CLIENT_ID=796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:8080/google-oauth-callback.html
```

**Important Notes:**
- Replace `YOUR_CLIENT_SECRET_HERE` with your actual Google OAuth Client Secret
- For production, update `GOOGLE_REDIRECT_URI` to your production domain
- After adding secrets, **redeploy your Edge Functions** for changes to take effect

### 2. Create Frontend Environment File (Optional)

Create a `.env.local` file in your project root:

```env
VITE_GOOGLE_CLIENT_ID=796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com
```

### 3. Verify Google Cloud Console Configuration

Make sure in Google Cloud Console:
- ✅ Google Drive API is enabled
- ✅ OAuth consent screen is configured
- ✅ Authorized redirect URI includes: `http://localhost:8080/google-oauth-callback.html`
- ✅ Authorized JavaScript origins includes: `http://localhost:8080`

### 4. Deploy Edge Functions

If you haven't already deployed the Edge Functions:

```bash
supabase functions deploy google-auth-init
supabase functions deploy google-auth-callback
supabase functions deploy google-drive-search
```

## 🧪 Testing

1. Start your development server: `npm run dev`
2. Navigate to Settings page
3. Find the "Google Drive Integration" section
4. Click "Connect Google Drive"
5. Complete the OAuth flow in the popup window
6. You should see "Connected as [your-email]" after successful connection

## 📝 Usage

Once connected, you can search Google Drive files using:

```typescript
import { searchGoogleDrive, isGoogleDriveConnected } from "@/lib/googleDrive";

// Check if connected
const isConnected = await isGoogleDriveConnected();

// Search for files
if (isConnected) {
  const files = await searchGoogleDrive("meeting notes", 10);
  console.log('Found files:', files);
}
```

## ❓ Troubleshooting

- **"Missing Google OAuth configuration"**: Check that all environment variables are set in Supabase Edge Functions
- **"Redirect URI mismatch"**: Verify the redirect URI in Google Cloud Console matches exactly
- **OAuth popup blocked**: Check browser popup blocker settings

