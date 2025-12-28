import landingLogo from "@/assets/landing-logo.png";
import { usePricingDialog } from "@/contexts/PricingDialogContext";
import { useNavigate } from "react-router-dom";

export function SiteFooter() {
  const navigate = useNavigate();
  const { openPricing } = usePricingDialog();

  return (
    <footer className="border-t border-border bg-white">
      <div className="container px-8 py-14">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand / blurb */}
          <div className="md:col-span-5">
            <button
              type="button"
              onClick={() => navigate("/")}
              aria-label="Go to home"
              className="inline-flex items-center"
            >
              <img src={landingLogo} alt="Jrnals" className="h-7 w-auto" loading="lazy" />
            </button>
            <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
              Jrnals turns your learning materials into notes, interactive chats, quizzes, and more — so you can spend
              less time organizing and more time learning.
            </p>
          </div>

          {/* Link columns */}
          <div className="md:col-span-7">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Product</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/#features")}
                      className="hover:text-foreground transition-colors"
                    >
                      Features
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={openPricing}
                      className="hover:text-foreground transition-colors"
                    >
                      Pricing
                    </button>
                  </li>
                </ul>
              </div>

              {/* NOTE: "Developers" column intentionally removed per request */}

              <div>
                <p className="text-sm font-semibold text-foreground">Company</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/fcareer")}
                      className="hover:text-foreground transition-colors"
                    >
                      Careers
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="hover:text-foreground transition-colors"
                    >
                      Contact
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">Legal</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>
                    <span className="cursor-default opacity-70">Terms of Service</span>
                  </li>
                  <li>
                    <span className="cursor-default opacity-70">Privacy Policy</span>
                  </li>
                  <li>
                    <span className="cursor-default opacity-70">Security</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Jrnals. All rights reserved.
        </div>
      </div>
    </footer>
  );
}


