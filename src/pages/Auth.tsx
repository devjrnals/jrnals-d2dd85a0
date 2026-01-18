import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { z } from "zod";

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: CredentialResponse) => void }) => void;
          renderButton: (element: HTMLElement, config: { theme?: string; size?: string; text?: string; width?: string }) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface CredentialResponse {
  credential: string;
  select_by: string;
}

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(128),
});

const signupSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, { message: "Display name is required" }).max(100),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const [isLogin, setIsLogin] = useState(modeParam === 'signup' ? false : true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  
  // Google Client ID - use existing one from codebase or environment variable
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "796017890896-t31g6ss0q0053jlfss3ceimvncab03kh.apps.googleusercontent.com";

  // Sync isLogin state with URL parameter
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'Has session' : 'No session');
      if (session && event === 'SIGNED_IN') {
        // Navigate to dashboard on sign in (handles both email and Google auth)
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validate input
      const schema = isLogin ? loginSchema : signupSchema;
      const data = isLogin ? { email, password } : { email, password, displayName };
      const result = schema.safeParse(data);

      if (!result.success) {
        const fieldErrors: typeof errors = {};
        result.error.errors.forEach((err) => {
          const field = err.path[0] as keyof typeof errors;
          fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password,
        });

        if (error) throw error;

        // Wait a moment for session to be established
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify session was created
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(sessionError.message || 'Failed to establish session');
        }

        if (!session) {
          // Try once more after a delay
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          
          if (retryError || !retrySession) {
            throw new Error('Session was not created. Please try again.');
          }
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });

        // Navigate to dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      } else {
        const validatedData = result.data as z.infer<typeof signupSchema>;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            data: {
              display_name: validatedData.displayName,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        // Track account signup
        try {
          await supabase.rpc('increment_accounts_count');
        } catch (error) {
          // Silently handle if function/table doesn't exist yet
          console.log('Account tracking not available yet:', error.message);
        }

        // Check if session was created (email confirmation may be disabled)
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Email confirmation is disabled, user is signed in
          toast({
            title: "Account created!",
            description: "You've successfully signed up.",
          });

          // Navigate to dashboard
          setTimeout(() => {
            navigate("/dashboard");
          }, 100);
        } else {
          // Email confirmation is required
          toast({
            title: "Account created!",
            description: "Please check your email to confirm your account before signing in.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Identity Services credential response
  const handleCredentialResponse = useCallback(async (response: CredentialResponse) => {
    try {
      setLoading(true);
      console.log('GSI credential received, starting authentication...');
      
      const { credential } = response; // This is the Google ID token
      
      if (!credential) {
        throw new Error('No credential received from Google');
      }

      console.log('Sending ID token to Supabase...');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
      });

      if (error) {
        console.error('Google authentication error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // Check for specific error codes and provide helpful messages
        if (error.code === 'provider_disabled' || error.message?.includes('not enabled')) {
          // Set flag to show setup dialog instead of just throwing
          setShowSetupDialog(true);
          setLoading(false);
          return;
        }
        
        throw error;
      }

      console.log('Authentication response:', data);

      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify session was created
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error after sign-in:', sessionError);
        throw new Error(sessionError.message || 'Failed to establish session');
      }

      if (!session) {
        // Try once more after a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
        
        if (retryError || !retrySession) {
          throw new Error('Session was not created. Please try again.');
        }
        
        console.log('Session created on retry');
      } else {
        console.log('Session created successfully');
      }

      // Success - redirect to dashboard
      toast({
        title: "Success!",
        description: "You've successfully signed in with Google.",
      });
      
      // Use a small delay before navigation to ensure state is updated
      setTimeout(() => {
        navigate("/dashboard");
      }, 100);
    } catch (error: any) {
      console.error('Google authentication error:', error);
      setLoading(false);
      
      // Provider disabled errors are handled above with the dialog
      if (error?.code === 'provider_disabled' || error?.message?.includes('not enabled')) {
        setShowSetupDialog(true);
        return;
      }
      
      let errorMessage = 'Failed to sign in with Google. ';
      let errorTitle = "Authentication Error";
      
      if (error?.message) {
        errorMessage += error.message;
      } else if (error?.error_description) {
        errorMessage += error.error_description;
      } else {
        errorMessage += 'Please try again or contact support if the problem persists.';
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [navigate, toast]);

  // Initialize Google Identity Services
  useEffect(() => {
    const initializeGSI = () => {
      if (typeof window.google !== 'undefined' && window.google.accounts && googleButtonRef.current) {
        try {
          // Clear any existing button
          if (googleButtonRef.current.hasChildNodes()) {
            googleButtonRef.current.innerHTML = '';
          }

          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
          });

          // Disable One Tap auto-select for now (can enable later if desired)
          window.google.accounts.id.disableAutoSelect();

          // Render the button
          if (googleButtonRef.current) {
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              width: '100%',
            });
          }
        } catch (error) {
          console.error('Error initializing Google Identity Services:', error);
        }
      }
    };

    // Wait for GSI script to load
    if (typeof window.google !== 'undefined') {
      initializeGSI();
    } else {
      // Retry when script loads
      const checkInterval = setInterval(() => {
        if (typeof window.google !== 'undefined') {
          clearInterval(checkInterval);
          initializeGSI();
        }
      }, 100);

      // Cleanup after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
      
      return () => clearInterval(checkInterval);
    }
  }, [GOOGLE_CLIENT_ID, handleCredentialResponse]);

  return (
    // Auth should always render in light mode, regardless of the last-used app theme.
    <div
      className="relative flex min-h-screen items-center justify-center bg-white text-gray-900"
      style={{
        "--background": "0 0% 100%",
        "--foreground": "222.2 84% 4.9%",
        "--card": "0 0% 100%",
        "--card-foreground": "222.2 84% 4.9%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "222.2 84% 4.9%",
        "--primary": "221.2 83.2% 53.3%",
        "--primary-foreground": "210 40% 98%",
        "--secondary": "210 40% 96%",
        "--secondary-foreground": "222.2 84% 4.9%",
        "--muted": "210 40% 96%",
        "--muted-foreground": "215.4 16.3% 46.9%",
        "--accent": "210 40% 96%",
        "--accent-foreground": "222.2 84% 4.9%",
        "--destructive": "0 84.2% 60.2%",
        "--destructive-foreground": "210 40% 98%",
        "--border": "214.3 31.8% 91.4%",
        "--input": "214.3 31.8% 91.4%",
        "--ring": "221.2 83.2% 53.3%",
        "--radius": "0.5rem",
      } as React.CSSProperties}
    >
      {/* Logo in top left */}
      <div className="absolute top-6 left-6">
        <img src="/logo.png" alt="Jrnals" className="h-8 w-auto" loading="eager" />
      </div>
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-muted-foreground">
            {isLogin
              ? "Sign in to your account to continue"
              : "Sign up to start journaling"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={!isLogin}
                maxLength={100}
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">{errors.displayName}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              maxLength={128}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full bg-[#030303] hover:bg-[#030303]/90 text-white" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Identity Services Button Container */}
        <div 
          ref={googleButtonRef} 
          className="w-full flex justify-center"
          style={{ minHeight: '40px' }}
        />

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#030303] hover:underline"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>

      {/* Google Provider Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Provider Not Enabled</DialogTitle>
            <DialogDescription>
              Google authentication is not enabled in your Supabase project. Please enable it in Authentication &gt; Providers &gt; Google.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSetupDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}