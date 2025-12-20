import { supabase } from "@/integrations/supabase/client";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
  size?: string;
}

/**
 * Search Google Drive for files matching the query
 * @param query - Search query string
 * @param maxResults - Maximum number of results to return (default: 10)
 * @returns Array of matching files
 */
export const searchGoogleDrive = async (
  query: string,
  maxResults: number = 10
): Promise<GoogleDriveFile[]> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    const accessToken = session?.session?.access_token;

    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/google-drive-search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxResults }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to search Google Drive');
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error searching Google Drive:', error);
    throw error;
  }
};

/**
 * Check if user has connected Google Drive
 * @returns Boolean indicating if Google Drive is connected
 */
export const isGoogleDriveConnected = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;

    const { data, error } = await (supabase as any)
      .from('google_drive_tokens')
      .select('id')
      .eq('user_id', user.id)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error checking Google Drive connection:', error);
    return false;
  }
};

/**
 * Get Google Drive connection info
 * @returns Google email if connected, null otherwise
 */
export const getGoogleDriveInfo = async (): Promise<{ email: string } | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await (supabase as any)
      .from('google_drive_tokens')
      .select('google_email')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return null;

    return { email: data.google_email };
  } catch (error) {
    console.error('Error getting Google Drive info:', error);
    return null;
  }
};

