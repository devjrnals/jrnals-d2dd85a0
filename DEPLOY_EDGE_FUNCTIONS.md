# How to Redeploy Supabase Edge Functions

## Prerequisites

### Option A: Use npx (No Installation Required - Recommended)

You can use `npx` to run Supabase CLI without installing it globally:

1. **Login to Supabase**:
   ```bash
   npx supabase login
   ```
   This will open a browser window for you to authenticate.

2. **Link your project** (if not already linked):
   ```bash
   npx supabase link --project-ref xfbxmheoblotlhpveugv
   ```
   Your project ID is already in `supabase/config.toml`, so this should work automatically.

### Option B: Install Supabase CLI

**For Windows (using Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Or download directly:**
- Visit: https://github.com/supabase/cli/releases
- Download the Windows executable
- Add it to your PATH

Then use `supabase` commands instead of `npx supabase`.

## Method 1: Deploy Individual Functions

Deploy each function one at a time:

```bash
# Deploy Google OAuth initialization function
supabase functions deploy google-auth-init

# Deploy Google OAuth callback function
supabase functions deploy google-auth-callback

# Deploy Google Drive search function
supabase functions deploy google-drive-search
```

## Method 2: Deploy All Functions at Once

Deploy all functions in one command:

```bash
supabase functions deploy
```

This will deploy all functions in the `supabase/functions/` directory.

## Method 3: Using npm Scripts (Recommended)

I've added convenient npm scripts to your `package.json`. You can now use:

```bash
# Deploy all Google Drive functions
npm run deploy:functions

# Or deploy all functions
npm run deploy:functions:all
```

## Important: Set Environment Variables First!

**Before deploying**, make sure you've set the environment variables in Supabase Dashboard:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Edge Functions** → **Secrets**
4. Add these secrets:
   - `GOOGLE_CLIENT_ID=796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE`
   - `GOOGLE_REDIRECT_URI=http://localhost:8080/google-oauth-callback.html`

**Note:** After setting secrets, you need to redeploy the functions for them to take effect.

## Verify Deployment

After deploying, you can verify your functions are live:

1. Go to Supabase Dashboard → **Edge Functions**
2. You should see all your functions listed
3. Click on a function to view logs and test it

## Troubleshooting

### "Project not linked"
```bash
npx supabase link --project-ref xfbxmheoblotlhpveugv
```

### "Not authenticated"
```bash
npx supabase login
```

### "Function deployment failed"
- Check that you're in the project root directory
- Verify the function files exist in `supabase/functions/[function-name]/index.ts`
- Check Supabase Dashboard for error logs

### Environment variables not working
- Make sure secrets are set in Supabase Dashboard (not just locally)
- Redeploy functions after setting secrets
- Check function logs in Supabase Dashboard for specific errors

## Quick Reference

**Using npx (recommended):**
```bash
# 1. Login (if needed) - opens browser for authentication
npx supabase login

# 2. Link project (if needed)
npx supabase link --project-ref xfbxmheoblotlhpveugv

# 3. Deploy all functions
npx supabase functions deploy

# Or deploy specific functions
npx supabase functions deploy google-auth-init
npx supabase functions deploy google-auth-callback
npx supabase functions deploy google-drive-search
```

**If you have Supabase CLI installed:**
```bash
# Replace 'npx supabase' with 'supabase' in all commands above
supabase login
supabase link --project-ref xfbxmheoblotlhpveugv
supabase functions deploy
```

