# Fix: Google Provider Not Enabled Error

## Error Messages

### Error 1: Provider Not Enabled
```
AuthApiError: Provider (issuer "https://accounts.google.com") is not enabled
Code: provider_disabled
```

### Error 2: Origin Not Allowed
```
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
Failed to load resource: the server responded with a status of 403
```

## Solution

### Step 1: Enable Google Provider in Supabase Dashboard

**Location**: [Supabase Dashboard](https://app.supabase.com) → Authentication → Providers

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project (if multiple projects)
3. Navigate to **Authentication** → **Providers**
4. Find **"Google"** in the list of providers
5. Toggle the switch from **"Disabled"** to **"Enabled"**

**Exact Path**: `https://app.supabase.com/project/[YOUR_PROJECT_ID]/auth/providers` → Click "Google" → Toggle "Enabled"

### Step 2: Add Google OAuth Credentials

**Location**: Same page as Step 1 (Google provider settings)

In the Google provider configuration form:

- **Client ID (for OAuth)**: `796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com`
- **Client Secret (for OAuth)**: `YOUR_CLIENT_SECRET_HERE` (store in Supabase Edge Functions secrets, not in code)
- Click **"Save"** button at the bottom of the form

**Important**: Make sure the Client ID matches exactly. Copy-paste it to avoid typos.

### Step 3: Fix "Origin Not Allowed" Error

**Location**: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials

If you see this error in the browser console:
```
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
```

**Fix steps:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the correct project (where your OAuth client is configured)
3. Navigate to **APIs & Services** → **Credentials**
   - **Exact Path**: `https://console.cloud.google.com/apis/credentials?project=[YOUR_PROJECT_ID]`
4. Find and click on your OAuth 2.0 Client ID: 
   - Client ID: `796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com`
5. Under **"Authorized JavaScript origins"** section:
   - Click **"+ ADD URI"** button
   - Add: `http://localhost:3000` (for development)
   - If you have a production domain, add: `https://yourdomain.com`
   - **Note**: Do not add trailing slashes
6. Under **"Authorized redirect URIs"** section:
   - Ensure you have: `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback`
   - If missing, click **"+ ADD URI"** and add it
7. Click **"Save"** button

**Important**: 
- The origin must match exactly (including `http://` vs `https://`)
- No trailing slashes allowed
- Changes may take a few minutes to propagate

### Step 4: Verify Configuration

After completing all steps:

1. **Wait 1-2 minutes** for changes to propagate
2. **Refresh your application** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
3. **Clear browser cache** or use an incognito/private window
4. Try signing in with Google again
5. The authentication should work now

## Troubleshooting

### Issue: "Provider (issuer 'https://accounts.google.com') is not enabled"

**Solution**: 
- Go to Supabase Dashboard → Authentication → Providers
- Verify Google provider is toggled to **"Enabled"** (green/checked)
- Verify Client ID and Client Secret are entered correctly
- Click "Save" if you made changes
- Wait 1-2 minutes and refresh the app

### Issue: "[GSI_LOGGER]: The given origin is not allowed for the given client ID"

**Solution**:
- Check your current origin in the browser address bar (e.g., `http://localhost:3000`)
- Go to Google Cloud Console → APIs & Services → Credentials
- Open your OAuth 2.0 Client ID
- Verify the exact origin is in "Authorized JavaScript origins"
- Ensure no trailing slashes (e.g., use `http://localhost:3000` not `http://localhost:3000/`)
- Save changes and wait 1-2 minutes
- Hard refresh the browser (Ctrl+Shift+R)

### Issue: "redirect_uri_mismatch" or similar errors

**Solution**:
- Verify redirect URI in Google Cloud Console matches exactly: `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback`
- No trailing slashes
- Check Supabase Dashboard → Authentication → URL Configuration for correct Site URL

### Issue: Changes not taking effect

**Solution**:
- Wait 2-3 minutes for changes to propagate
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- Clear browser cache or use incognito mode
- Restart development server if using one
- Check browser console for new errors

### Issue: Client ID mismatch

**Solution**:
- Verify the Client ID in `src/pages/Auth.tsx` matches the one in Supabase Dashboard
- Verify the Client ID in Google Cloud Console matches both
- All three locations must use: `796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com`

## Configuration Checklist

Before testing, verify:

- [ ] Google provider is **Enabled** in Supabase Dashboard
- [ ] Client ID is entered correctly in Supabase Dashboard (Google provider settings)
- [ ] Client Secret is entered correctly in Supabase Dashboard
- [ ] "Save" button was clicked in Supabase Dashboard
- [ ] Current origin is in Google Cloud Console "Authorized JavaScript origins"
- [ ] Redirect URI `https://xfbxmheoblotlhpveugv.supabase.co/auth/v1/callback` is in Google Cloud Console
- [ ] "Save" button was clicked in Google Cloud Console
- [ ] Waited 1-2 minutes for changes to propagate
- [ ] Browser was hard refreshed (Ctrl+Shift+R)
- [ ] Tested in incognito/private window (if still having issues)

## Important Notes

- The Client ID used in GSI initialization (`src/pages/Auth.tsx`) must **exactly match** the Client ID configured in Supabase Dashboard
- Both Supabase Dashboard and Google Cloud Console must be configured correctly
- Changes in Supabase Dashboard may take 1-2 minutes to propagate
- Changes in Google Cloud Console may take 1-2 minutes to propagate
- After enabling, clear browser cache or use an incognito window to test
- Make sure you're configuring the correct Google Cloud project (check project selector in top bar)
- Verify you have the correct Supabase project selected in the dashboard

