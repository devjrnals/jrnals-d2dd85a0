import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type BillingInterval = "annual" | "monthly";

type Props = {
  open: boolean;
  onClose: () => void;
  onUpgrade?: (interval: BillingInterval) => void;
};

const FEATURES = [
  "Unlimited journals, folders, and history",
  "Smarter search + better AI writing help",
  "Unlimited faster AI edits",
  "Premium quizzes, flashcards, and podcasts",
  "Unlimited chat conversations and notes",
];

export function PremiumPanel({ open, onClose, onUpgrade }: Props) {
  const [interval, setInterval] = useState<BillingInterval>("annual");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const pricing = useMemo(
    () => ({
      annual: { label: "Annual", badge: "Save 50%", price: "$11.99", cadence: "/ month", footnote: "Billed yearly" },
      monthly: { label: "Monthly", price: "$23.99", cadence: "/ month", footnote: "Billed monthly" },
    }),
    [],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close upgrade panel"
        className="absolute inset-0 bg-background/35 backdrop-blur-sm"
        onMouseDown={onClose}
      />

      <div
        className={cn(
          "absolute left-1/2 top-1/2 w-[min(520px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2",
          "h-[min(620px,calc(100%-2rem))]",
          "rounded-2xl border border-border/60 shadow-2xl",
          "bg-background/70 supports-[backdrop-filter]:backdrop-blur-2xl",
          "overflow-hidden",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade"
      >
        <div className="relative h-full">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/18 via-primary/8 to-transparent" />

          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 p-6 pb-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold text-foreground">Upgrade to Plus</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Faster, smarter, and unlimited — with Jrnals Plus.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto px-6 pb-6">
              <div className="space-y-6">
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <ul className="space-y-3">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInterval("annual")}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      interval === "annual"
                        ? "border-primary/60 bg-primary/10 shadow-sm"
                        : "border-border/60 bg-background/40 hover:bg-muted/30",
                    )}
                    aria-pressed={interval === "annual"}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{pricing.annual.label}</div>
                      <div className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        {pricing.annual.badge}
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <div className="text-3xl font-semibold text-foreground">{pricing.annual.price}</div>
                      <div className="text-sm text-muted-foreground">{pricing.annual.cadence}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{pricing.annual.footnote}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInterval("monthly")}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      interval === "monthly"
                        ? "border-primary/60 bg-primary/10 shadow-sm"
                        : "border-border/60 bg-background/40 hover:bg-muted/30",
                    )}
                    aria-pressed={interval === "monthly"}
                  >
                    <div className="text-sm font-medium text-foreground">{pricing.monthly.label}</div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <div className="text-3xl font-semibold text-foreground">{pricing.monthly.price}</div>
                      <div className="text-sm text-muted-foreground">{pricing.monthly.cadence}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{pricing.monthly.footnote}</div>
                  </button>
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => onUpgrade?.(interval)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade Now
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Join <span className="font-semibold text-foreground">5,000,000+</span> people working smarter with Jrnals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


