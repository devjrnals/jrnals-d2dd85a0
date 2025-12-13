import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Sparkles, Brain, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";

export const Landing = () => {
  const navigate = useNavigate();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-load *any* images placed in src/assets/partner-logos/
  // (filenames and university names don't matter).
  const partnerLogoModules = import.meta.glob(
    "../assets/partner-logos/*.{png,jpg,jpeg,webp,svg}",
    { eager: true, query: "?url", import: "default" },
  ) as Record<string, string>;

  const partnerLogoUrls = Object.values(partnerLogoModules);

  const partnerLogos =
    partnerLogoUrls.length > 0
      ? partnerLogoUrls.map((src, i) => ({ alt: `University logo ${i + 1}`, src }))
      : [
          // Fallback to repo-provided placeholders if no assets were added yet
          { alt: "Harvard", src: "/logos/harvard.svg" },
          { alt: "MIT", src: "/logos/mit.svg" },
          { alt: "Stanford", src: "/logos/stanford.svg" },
          { alt: "Yale", src: "/logos/yale.svg" },
          { alt: "Michigan", src: "/logos/michigan.svg" },
          { alt: "Caltech", src: "/logos/caltech.svg" },
        ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-colors",
          "supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:saturate-150",
          isHeaderScrolled
            ? "border-border/70 bg-background/85 shadow-sm"
            : "border-transparent bg-background/55",
        )}
      >
        <div className="container flex h-16 items-center justify-between px-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center">
              <img
                src={logoDark}
                alt="TaskLearn"
                className="h-7 w-auto dark:hidden"
                loading="eager"
              />
              <img
                src={logoLight}
                alt="TaskLearn"
                className="hidden h-7 w-auto dark:block"
                loading="eager"
              />
            </div>
            <nav className="hidden md:flex gap-6">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </button>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </button>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Careers
              </button>
            </nav>
          </div>
          <Button onClick={() => navigate("/auth")} className="bg-foreground text-background hover:bg-foreground/90">
            Start Learning
          </Button>
        </div>
      </header>

      <main className="pt-16">
      {/* Hero Section */}
      <section className="container px-8 py-20 text-center">
        <Badge variant="secondary" className="mb-6">
          <Sparkles className="w-3 h-3 mr-1" />
          Backed by Y Combinator
        </Badge>
        
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 max-w-3xl mx-auto">
          An AI tutor made for you
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Turns your learning materials into notes, interactive chats, quizzes, and more
        </p>

        <div className="flex justify-center mb-8">
          <Button size="lg" onClick={() => navigate("/auth")} className="bg-foreground text-background hover:bg-foreground/90">
            Try for free
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Loved by <span className="font-semibold text-foreground">3,000,000+</span> learners
        </p>

        {/* App Preview */}
        <div className="mt-16 rounded-xl border border-border shadow-2xl overflow-hidden bg-card max-w-5xl mx-auto">
          <div className="aspect-video bg-muted flex items-center justify-center">
            <div className="text-center p-8">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Interactive Editor Preview</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="container px-8 py-16">
        <p className="text-sm text-muted-foreground text-center mb-6">
          Trusted by top students all over the world
        </p>
        <div className="relative overflow-hidden rounded-2xl py-8 marquee-edge-fade">
          <div className="flex min-w-max items-center gap-16 animate-marquee pr-16">
            {partnerLogos.concat(partnerLogos).map((logo, index) => (
              <div key={`${logo.src}-${index}`} className="flex-shrink-0 px-4">
                <img
                  src={logo.src}
                  alt={logo.alt}
                  loading="lazy"
                  className="h-16 w-auto md:h-20 drop-shadow-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="container px-8 py-20 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Save hours, learn smarter.
        </h2>
        <p className="text-xl text-muted-foreground mb-16 max-w-2xl mx-auto">
          From key takeaways to specific questions, we've got you covered.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Feature Card 1 */}
          <div className="bg-card border border-border rounded-xl p-8 text-left">
            <Brain className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Summary, quizzes, podcast, and more
            </h3>
            <p className="text-muted-foreground">
              Understand the key points, test your knowledge, get answers with references, and chat with your docs.
            </p>
          </div>

          {/* Feature Card 2 */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center">
              <Search className="w-16 h-16 text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-20">
        <div className="container px-8 text-center text-sm text-muted-foreground">
          © 2024 TaskLearn. All rights reserved.
        </div>
      </footer>
      </main>
    </div>
  );
};
