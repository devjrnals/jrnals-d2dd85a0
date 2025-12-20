import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const GoogleDriveIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Check if Google Drive is already connected
  useEffect(() => {
    checkConnection();
  }, [user]);

  const checkConnection = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('google_drive_tokens')
        .select('google_email')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setIsConnected(true);
        setGoogleEmail(data.google_email);
      } else {
        setIsConnected(false);
        setGoogleEmail(null);
      }
    } catch (error) {
      console.error('Error checking Google Drive connection:', error);
    }
  };

  const handleConnect = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to connect Google Drive.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get auth URL from Edge Function
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/google-auth-init`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to initiate Google OAuth');
      }

      const { authUrl } = await response.json();

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'Google OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth callback
      window.addEventListener('message', async (event) => {
        if (event.data.type === 'google-oauth-success') {
          popup?.close();
          
          // Exchange code for tokens via Edge Function
          const { code, state } = event.data;
          
          const callbackResponse = await fetch(
            `${supabaseUrl}/functions/v1/google-auth-callback`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ code, state }),
            }
          );

          if (!callbackResponse.ok) {
            throw new Error('Failed to exchange OAuth code');
          }

          const result = await callbackResponse.json();

          toast({
            title: "Google Drive connected",
            description: `Successfully connected ${result.email}`,
          });

          setIsConnected(true);
          setGoogleEmail(result.email);
          setIsLoading(false);
        } else if (event.data.type === 'google-oauth-error') {
          popup?.close();
          throw new Error(event.data.error || 'OAuth failed');
        }
      });
    } catch (error) {
      console.error('Error connecting Google Drive:', error);
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect Google Drive",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const { error } = await (supabase as any)
        .from('google_drive_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Google Drive disconnected",
        description: "Your Google Drive has been disconnected successfully.",
      });

      setIsConnected(false);
      setGoogleEmail(null);
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error);
      toast({
        title: "Disconnection failed",
        description: "Failed to disconnect Google Drive",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isConnected ? (
            <Cloud className="h-5 w-5 text-green-500" />
          ) : (
            <CloudOff className="h-5 w-5 text-gray-400" />
          )}
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          {isConnected
            ? `Connected as ${googleEmail}`
            : "Connect your Google Drive to enable document search"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect Google Drive'
            )}
          </Button>
        ) : (
          <Button onClick={handleConnect} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Cloud className="mr-2 h-4 w-4" />
                Connect Google Drive
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

