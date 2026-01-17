import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for errors in URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (error) {
          throw new Error(errorDescription || error || 'Authentication failed');
        }

        // Also check hash parameters (Supabase OAuth returns tokens in the hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashError = hashParams.get('error');
        const hashErrorDescription = hashParams.get('error_description');

        if (hashError) {
          throw new Error(hashErrorDescription || hashError || 'Authentication failed');
        }

        // Wait for Supabase to process the OAuth callback
        // Supabase automatically extracts tokens from the URL hash
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if we have a session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          throw new Error(sessionError.message || 'Failed to establish session');
        }

        if (!session) {
          // Try one more time after a short delay
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          
          if (retryError || !retrySession) {
            throw new Error('Failed to establish session. Please try signing in again.');
          }
          
          // Success with retry
          toast({
            title: "Success!",
            description: "You've successfully signed in with Google.",
          });
          navigate("/dashboard");
          return;
        }

        // Success - redirect to dashboard
        toast({
          title: "Success!",
          description: "You've successfully signed in with Google.",
        });

        navigate("/dashboard");
      } catch (error: any) {
        console.error('Auth callback error:', error);
        toast({
          title: "Authentication Error",
          description: error.message || "Failed to complete authentication. Please try again.",
          variant: "destructive",
        });
        navigate("/auth");
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}

