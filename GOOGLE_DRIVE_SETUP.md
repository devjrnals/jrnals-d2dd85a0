# Google Drive Integration Setup Guide

This guide will help you set up Google Drive integration for your application.

## Prerequisites

- Google Cloud Console account
- Supabase project with Edge Functions support
- Google Drive API credentials

## Step 1: Google Cloud Console Setup

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create or select a project**

3. **Enable Google Drive API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Add Authorized JavaScript origins:
     - `http://localhost:8080` (development)
     - Your production domain
   - Add Authorized redirect URIs:
     - `http://localhost:8080/google-oauth-callback.html` (development)
     - `https://yourdomain.com/google-oauth-callback.html` (production)
   - Save your **Client ID** and **Client Secret**

5. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Fill in app name, user support email, developer contact
   - Add scopes:
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Save and continue

## Step 2: Database Migration

Run the migration to create required tables:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration manually in Supabase dashboard
# Run the SQL from: supabase/migrations/20251218000000_google_drive_integration.sql
```

This creates two tables:
- `google_drive_tokens` - Stores OAuth tokens securely
- `google_drive_files_cache` - Caches file metadata for faster search

## Step 3: Supabase Edge Functions Configuration

### Set Environment Variables in Supabase

Go to your Supabase project dashboard:
1. Navigate to "Edge Functions" settings
2. Add the following secrets:

```bash
GOOGLE_CLIENT_ID=1096408826522-qugsq6s37ni23l7kguucdl4s0mh88v17.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:8080/google-oauth-callback.html
```

**For Production:**
Update `GOOGLE_REDIRECT_URI` to your production domain.

### Deploy Edge Functions

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy google-auth-init
supabase functions deploy google-auth-callback
supabase functions deploy google-drive-search
```

## Step 4: Frontend Configuration

Create a `.env.local` file in your project root:

```env
# Your existing Supabase config
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Client ID (Frontend only - safe to expose)
VITE_GOOGLE_CLIENT_ID=1096408826522-qugsq6s37ni23l7kguucdl4s0mh88v17.apps.googleusercontent.com
```

**⚠️ Important Security Notes:**
- ✅ Only expose `GOOGLE_CLIENT_ID` to the frontend
- ❌ NEVER expose `GOOGLE_CLIENT_SECRET` in frontend code
- ✅ Store `GOOGLE_CLIENT_SECRET` only in Supabase Edge Functions environment

## Step 5: Usage

### Add to Settings Page

Import and use the GoogleDriveIntegration component:

```typescript
import { GoogleDriveIntegration } from "@/components/GoogleDriveIntegration";

// In your Settings or Profile page
<GoogleDriveIntegration />
```

### Search Google Drive

Use the utility functions to search files:

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

## API Endpoints

### 1. Initiate OAuth Flow
```
POST /functions/v1/google-auth-init
Authorization: Bearer <supabase-access-token>
```

Returns the Google OAuth URL for user authorization.

### 2. OAuth Callback
```
POST /functions/v1/google-auth-callback
Content-Type: application/json

{
  "code": "authorization_code",
  "state": "user_id"
}
```

Exchanges authorization code for tokens and stores them securely.

### 3. Search Google Drive
```
POST /functions/v1/google-drive-search
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "query": "search terms",
  "maxResults": 10
}
```

Returns matching files from user's Google Drive.

## File Structure

```
supabase/
├── migrations/
│   └── 20251218000000_google_drive_integration.sql
└── functions/
    ├── google-auth-init/
    │   └── index.ts
    ├── google-auth-callback/
    │   └── index.ts
    └── google-drive-search/
        └── index.ts

src/
├── components/
│   └── GoogleDriveIntegration.tsx
└── lib/
    └── googleDrive.ts

public/
└── google-oauth-callback.html
```

## Troubleshooting

### "Missing Google OAuth configuration"
- Ensure all environment variables are set in Supabase Edge Functions settings
- Redeploy the functions after setting environment variables

### "Redirect URI mismatch"
- Verify the redirect URI in Google Cloud Console matches exactly
- Include the protocol (http:// or https://)
- Check for trailing slashes

### "Token expired" errors
- The system automatically refreshes expired tokens
- Ensure `refresh_token` is being stored correctly

### OAuth popup blocked
- Browser may block popups - check popup blocker settings
- User must allow popups for the OAuth flow

## Next Steps

To enhance the integration:

1. **Implement RAG (Retrieval-Augmented Generation)**
   - Extract text content from different file types (PDF, Docs, Sheets)
   - Generate embeddings for semantic search
   - Use Supabase pgvector for vector storage
   - Integrate with LLM for Q&A

2. **Add File Sync**
   - Periodic background sync of Drive files
   - Webhooks for real-time updates
   - Full-text indexing for faster search

3. **Support Multiple Cloud Providers**
   - Dropbox integration
   - OneDrive integration
   - Box integration

## Security Best Practices

✅ **DO:**
- Store tokens server-side only (Edge Functions)
- Use Row Level Security (RLS) policies
- Implement token refresh logic
- Validate all user inputs
- Use HTTPS in production

❌ **DON'T:**
- Expose client secrets in frontend code
- Store tokens in localStorage or cookies
- Skip token expiration checks
- Hardcode credentials in code

## Support

For issues or questions:
- Check Supabase Edge Functions logs
- Review Google Cloud Console API quotas
- Verify OAuth scopes are approved by users

