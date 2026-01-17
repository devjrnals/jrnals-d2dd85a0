import { Button } from "@/components/ui/button";
import { usePricingDialog } from "@/contexts/PricingDialogContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export function SiteHeader() {
  const navigate = useNavigate();
  const { openPricing } = usePricingDialog();
  const { user } = useAuth();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors", isHeaderScrolled ? "bg-transparent" : "border-transparent bg-background/55")}>
      <div className="flex h-16 items-center justify-between px-8 w-full">
        <div className={cn("flex items-center gap-8 rounded-lg px-4 py-2 transition-all", isHeaderScrolled ? "bg-background" : "")}>
          <button 
            type="button" 
            className="flex items-center" 
            aria-label="Go to home" 
            onClick={() => {
              if (window.location.pathname === "/" || window.location.pathname === "/landing") {
                window.scrollTo({
                  top: 0,
                  behavior: "smooth"
                });
              } else {
                navigate("/");
              }
            }}
          >
            <img src="/logo.png" alt="Jrnals" className="h-7 w-auto" loading="eager" />
          </button>
          <nav className="hidden md:flex gap-6">
            <button 
              className="text-base text-muted-foreground hover:text-foreground transition-colors" 
              onClick={() => {
                if (window.location.pathname === "/") {
                  document.getElementById('first-learning-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  navigate("/#first-learning-section");
                }
              }}
            >
              Features
            </button>
            <button 
              className="text-base text-muted-foreground hover:text-foreground transition-colors" 
              onClick={openPricing}
            >
              Pricing
            </button>
            <button 
              className="text-base text-muted-foreground hover:text-foreground transition-colors" 
              onClick={() => navigate("/careers")}
            >
              Careers
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Button 
              onClick={() => navigate("/dashboard")} 
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-8 py-3 text-base font-medium"
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Button 
                onClick={() => navigate("/auth?mode=login")} 
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-8 py-3 text-base font-medium"
              >
                Log In
              </Button>
              <Button 
                onClick={() => navigate("/auth?mode=signup")} 
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-8 py-3 text-base font-medium"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

