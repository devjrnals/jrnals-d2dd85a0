import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import landingLogo from "@/assets/landing-logo.png";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Email validation schema
const emailSchema = z.string().trim().email({
  message: "Invalid email address"
}).max(255, {
  message: "Email is too long"
});

// Access password (for early access)
const ACCESS_PASSWORD = "access2025";
export default function ComingSoon() {
  // Render on a fixed 16:9 "artboard" and scale to the viewport so spacing + type match the reference image.
  const DESIGN = useMemo(() => ({
    w: 1440,
    h: 810
  }), []);
  const [scale, setScale] = useState(1);
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const handleAccessSubmit = () => {
    const trimmedPassword = accessPassword.trim();
    if (trimmedPassword === ACCESS_PASSWORD) {
      // Store access granted in sessionStorage
      sessionStorage.setItem("early_access_granted", "true");
      toast({
        title: "Access granted!",
        description: "Welcome to Jrnals early access."
      });
      setShowAccessDialog(false);
      setAccessPassword("");
      navigate("/landing");
    } else {
      toast({
        title: "Invalid password",
        description: "Please check your access code and try again.",
        variant: "destructive"
      });
    }
  };
  const handleEmailSubmit = async () => {
    // Validate email with zod
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      toast({
        title: "Error",
        description: result.error.errors[0]?.message || "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    const validatedEmail = result.data;
    setEmailLoading(true);
    try {
      const {
        error
      } = await supabase.from("coming_soon_emails").insert([{
        email: validatedEmail
      }]);
      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          toast({
            title: "Already subscribed",
            description: "This email is already on our list!"
          });
        } else if (error.message?.includes('relation "public.coming_soon_emails" does not exist')) {
          // Table doesn't exist yet - show a message but don't fail completely
          toast({
            title: "Thank you!",
            description: "Your email has been noted. Database setup is in progress."
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Success!",
          description: "Thank you for your interest. We'll keep you updated!"
        });
        setEmail("");
      }
    } catch (error) {
      console.error("Error saving email:", error);
      toast({
        title: "Error",
        description: "Failed to save your email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setEmailLoading(false);
    }
  };
  useEffect(() => {
    const compute = () => {
      const next = Math.min(window.innerWidth / DESIGN.w, window.innerHeight / DESIGN.h);
      setScale(Math.max(0.25, Math.min(2, next)));
    };
    compute();
    window.addEventListener("resize", compute, {
      passive: true
    });
    return () => window.removeEventListener("resize", compute);
  }, [DESIGN.h, DESIGN.w]);
  return <div className="relative min-h-screen w-full overflow-hidden bg-white text-black">
      {/* Full-screen soft blobs (blue/purple on white) */}
      <div className="pointer-events-none absolute inset-0">
        {/* big atmospheric washes */}
        <div className="absolute -left-52 -top-56 h-[680px] w-[680px] rounded-full bg-indigo-600/28 blur-3xl" />
        <div className="absolute left-[8%] top-[64%] h-[720px] w-[720px] rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute right-[-240px] top-[-140px] h-[820px] w-[820px] rounded-full bg-violet-600/22 blur-3xl" />
        <div className="absolute right-[-180px] top-[52%] h-[760px] w-[760px] rounded-full bg-purple-600/18 blur-3xl" />

        {/* extra blobs for depth (closer to the reference) */}
        <div className="absolute left-[-180px] top-[16%] h-[520px] w-[520px] rounded-full bg-blue-500/16 blur-3xl" />
        <div className="absolute left-[28%] top-[-140px] h-[480px] w-[480px] rounded-full bg-indigo-500/14 blur-3xl" />
        <div className="absolute left-[42%] top-[82%] h-[520px] w-[520px] rounded-full bg-violet-500/14 blur-3xl" />
        <div className="absolute right-[20%] top-[18%] h-[520px] w-[520px] rounded-full bg-indigo-500/14 blur-3xl" />
        <div className="absolute right-[6%] top-[66%] h-[520px] w-[520px] rounded-full bg-blue-500/14 blur-3xl" />
        <div className="absolute right-[2%] top-[34%] h-[420px] w-[420px] rounded-full bg-purple-500/14 blur-3xl" />
        <div className="absolute left-[56%] top-[36%] h-[420px] w-[420px] rounded-full bg-violet-500/12 blur-3xl" />
        <div className="absolute left-[14%] top-[42%] h-[380px] w-[380px] rounded-full bg-indigo-500/12 blur-3xl" />

        {/* subtle paper tint */}
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_50%,rgba(79,70,229,0.14),rgba(255,255,255,0)_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_18%_12%,rgba(59,130,246,0.12),rgba(255,255,255,0)_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_82%_18%,rgba(168,85,247,0.12),rgba(255,255,255,0)_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_72%_78%,rgba(99,102,241,0.10),rgba(255,255,255,0)_60%)]" />
      </div>

      {/* Scaled artboard */}
      <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-6">
        <div className="relative" style={{
        width: DESIGN.w,
        height: DESIGN.h,
        transform: `scale(${scale})`,
        transformOrigin: "center"
      }}>
          {/* Top bar */}
          <div className="flex items-start justify-between gap-6 px-16 pt-14">
            <div className="flex items-start gap-4">
              <div className="leading-tight">
                <img src={landingLogo} alt="Jrnals" className="h-9 w-auto" />
              </div>
            </div>

            <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.2em] text-black/80">
              <Button type="button" variant="ghost" onClick={() => setShowAccessDialog(true)} className="h-8 rounded-none px-3 text-xs uppercase tracking-[0.2em] text-black/80 hover:bg-black/5 hover:text-black border border-black/20">
                Access
              </Button>
              <span className="select-none text-black/60">—</span>
              <button type="button" className="hover:text-black transition-colors">
                Instagram
              </button>
              <button type="button" className="hover:text-black transition-colors">
                Twitter
              </button>
            </nav>
          </div>

          {/* Hero */}
          <div className="mt-24 grid grid-cols-12 items-end gap-8 px-16">
            <div className="col-span-12">
              <h1 className="font-serif text-[180px] leading-[0.85] tracking-[-0.03em] text-black">
                Coming Soon
              </h1>
            </div>
          </div>

          {/* Gradient swash overlapping the hero text (like the reference) */}
          <div className="pointer-events-none absolute left-0 right-0 top-[140px] px-16">
            <div className="relative h-[320px]">
              {/* left side wash across the "Co" */}
              <div className="absolute left-[-10px] top-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-500/42 via-indigo-500/30 to-purple-500/42 blur-2xl mix-blend-multiply" />
              {/* mid swash through the center of the headline */}
              <div className="absolute left-[260px] top-8 h-[320px] w-[520px] rotate-[-16deg] rounded-[999px] bg-gradient-to-r from-purple-500/38 via-indigo-500/26 to-blue-500/38 blur-2xl mix-blend-multiply" />
              {/* small accent blob near the middle */}
              <div className="absolute left-[660px] top-20 h-56 w-56 rounded-full bg-gradient-to-tr from-indigo-500/28 via-violet-500/22 to-blue-500/28 blur-2xl mix-blend-multiply" />
              {/* right side wash brushing the end of the headline */}
              <div className="absolute left-[860px] top-0 h-[300px] w-[600px] rotate-[10deg] rounded-[999px] bg-gradient-to-r from-blue-500/30 via-indigo-500/22 to-purple-500/30 blur-2xl mix-blend-multiply" />
              <div className="absolute left-[1120px] top-34 h-56 w-56 rounded-full bg-gradient-to-tr from-purple-500/22 via-indigo-500/18 to-blue-500/22 blur-2xl mix-blend-multiply" />
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-24 grid grid-cols-12 gap-10 border-t border-black/25 px-16 pt-10">
            {/* About */}
            <div className="col-span-7">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/80">About</div>
                <p className="col-span-9 text-sm leading-relaxed text-black/80">
                  Building context for education. Jrnals provides richer learning context by integrating key coursework platforms like Canvas, Notion, and Google Drive. Students can create journals that use integrated context to deliver accurate insights, support homework, and improve study techniques.
                </p>
              </div>
            </div>

            {/* Notify */}
            <div className="col-span-5 justify-self-end self-start">
              <div className="flex w-[420px] items-end gap-4">
                <div className="w-full">
                  <label className="mb-2 block text-xs text-black/70" htmlFor="notify-email">
                    Notify me on release
                  </label>
                  <Input id="notify-email" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleEmailSubmit();
                  }
                }} placeholder="Your email" className="h-10 rounded-none border-0 border-b border-black/40 bg-transparent px-0 text-black placeholder:text-black/50 focus-visible:ring-0 focus-visible:ring-offset-0" />
                </div>
                <Button type="button" variant="ghost" onClick={handleEmailSubmit} disabled={emailLoading} className="h-10 rounded-none px-1 text-xs uppercase tracking-[0.2em] text-black/80 hover:bg-transparent hover:text-black disabled:opacity-50">
                  {emailLoading ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Access Dialog */}
      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Early Access</DialogTitle>
            <DialogDescription>
              Enter your access code to get early access to Jrnals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input type="password" placeholder="Access code" value={accessPassword} onChange={e => setAccessPassword(e.target.value)} onKeyDown={e => {
            if (e.key === 'Enter') {
              handleAccessSubmit();
            }
          }} className="w-full" />
            <Button onClick={handleAccessSubmit} className="w-full">
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}