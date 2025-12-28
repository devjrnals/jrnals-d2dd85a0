import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, Globe, Megaphone, TrendingUp } from "lucide-react";
import landingLogo from "@/assets/landing-logo.png";
import { usePricingDialog } from "@/contexts/PricingDialogContext";
import { SiteFooter } from "@/components/SiteFooter";

type PositionTag = {
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type Position = {
  title: string;
  compensation?: string;
  description: string;
  accentClassName: string;
  tags: PositionTag[];
  href?: string;
};

const positions: Position[] = [
  {
    title: "Content Creator",
    description:
      "Create engaging content for TikTok and Instagram to help millions of students discover Jrnals.",
    accentClassName: "from-fuchsia-500/25 via-purple-500/15 to-indigo-500/25",
    tags: [
      { label: "Marketing", icon: Megaphone },
      { label: "Remote (US Timezones)", icon: Globe },
      { label: "Part-time", icon: Clock },
    ],
    href: "mailto:careers@tasklearn.ai?subject=Application%3A%20Content%20Creator%20(Jrnals)",
  },
  {
    title: "Growth Intern",
    description:
      "Run rapid experiments across creators, communities, and campus ambassadors to find repeatable growth loops.",
    accentClassName: "from-emerald-500/20 via-cyan-500/10 to-blue-500/20",
    tags: [
      { label: "Growth", icon: TrendingUp },
      { label: "Remote (US Timezones)", icon: Globe },
      { label: "Internship", icon: Clock },
    ],
    href: "mailto:careers@tasklearn.ai?subject=Application%3A%20Growth%20Intern%20(Jrnals)",
  },
];

export default function FCareer() {
  const navigate = useNavigate();
  const { openPricing } = usePricingDialog();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-white text-gray-900"
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
      {/* Background accents (Landing-like, but simpler) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_520px_at_50%_-10%,rgba(59,130,246,0.16),rgba(255,255,255,0)_60%)]" />
        <div className="absolute -right-44 top-28 h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -left-52 bottom-14 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white to-white" />
      </div>

      {/* Header (Landing-style) */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-colors",
          "supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:saturate-150",
          isHeaderScrolled ? "border-border/70 bg-background/85 shadow-sm" : "border-transparent bg-background/55",
        )}
      >
        <div className="container flex h-16 items-center justify-between px-8">
          <div className="flex items-center gap-8">
            <button
              className="flex items-center"
              onClick={() => {
                navigate("/");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label="Go to home"
              type="button"
            >
              <img src={landingLogo} alt="Jrnals" className="h-7 w-auto" loading="eager" />
            </button>
            <nav className="hidden gap-6 md:flex">
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => navigate("/#features")}
                type="button"
              >
                Features
              </button>
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={openPricing}
                type="button"
              >
                Pricing
              </button>
              <button className="text-sm font-medium text-foreground" onClick={() => navigate("/fcareer")} type="button">
                Careers
              </button>
            </nav>
          </div>
          <Button
            onClick={() => navigate("/auth")}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            Start Learning
          </Button>
        </div>
      </header>

      <main className="relative pt-16">
        <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-12 md:px-10 md:pt-16">
        {/* Hero */}
        <section className="text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Careers &amp; Internships
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-muted-foreground md:text-base">
            Join us in building AI tools that make the lives of millions of students better. Small team, big impact.
          </p>
        </section>

        {/* Open positions */}
        <section className="mt-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-lg font-semibold text-foreground md:text-xl">
              <span className="text-primary">✦</span>
              <span className="tracking-tight">Open Positions</span>
            </div>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              {positions.length} Open
            </Badge>
          </div>

          <div className="mt-6 space-y-5">
            {positions.map((p) => (
              <div
                key={p.title}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
                )}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-r opacity-60", p.accentClassName)} />
                <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:gap-10 md:p-8">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{p.title}</h3>
                      {p.compensation ? (
                        <span className="text-sm text-muted-foreground md:text-base">({p.compensation})</span>
                      ) : null}
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{p.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {p.tags.map((t) => {
                        const Icon = t.icon;
                        return (
                          <span
                            key={`${p.title}-${t.label}`}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground/80"
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {t.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    className="h-10 justify-between gap-2 rounded-full px-5"
                  >
                    <a href={p.href ?? "#"}>
                      View Position <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-sm md:p-12">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10" />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Don't see the right role?</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
                We're always looking for exceptional people. Send us your resume and we'll keep you in mind for future
                opportunities.
              </p>
              <div className="mt-6 flex justify-center">
                <Button
                  asChild
                  className="h-11 rounded-full bg-foreground px-7 text-background hover:bg-foreground/90"
                >
                  <a href="mailto:careers@tasklearn.ai?subject=General%20Interest%20-%20Jrnals%20Careers">
                    Get in Touch <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}


