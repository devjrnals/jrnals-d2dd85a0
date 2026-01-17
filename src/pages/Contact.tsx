import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, HelpCircle, Instagram } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function Contact() {
  return (
    <div className="min-h-screen bg-white text-gray-900" style={{
      '--background': '0 0% 100%',
      '--foreground': '222.2 84% 4.9%',
      '--card': '0 0% 100%',
      '--card-foreground': '222.2 84% 4.9%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '222.2 84% 4.9%',
      '--primary': '221.2 83.2% 53.3%',
      '--primary-foreground': '210 40% 98%',
      '--secondary': '210 40% 96%',
      '--secondary-foreground': '222.2 84% 4.9%',
      '--muted': '210 40% 96%',
      '--muted-foreground': '215.4 16.3% 46.9%',
      '--accent': '210 40% 96%',
      '--accent-foreground': '222.2 84% 4.9%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '214.3 31.8% 91.4%',
      '--input': '214.3 31.8% 91.4%',
      '--ring': '221.2 83.2% 53.3%',
      '--radius': '0.5rem'
    } as React.CSSProperties}>
      <SiteHeader />

      <main className="pt-16">
        {/* Hero Section */}
        <section className="container px-8 py-20 text-center">
          <Badge variant="secondary" className="mb-6">
            <MessageSquare className="w-3 h-3 mr-1" />
            Get in Touch
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 max-w-3xl mx-auto">
            Contact Us
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Have questions about Jrnals? We're here to help you get the most out of our platform.
          </p>

          {/* Contact Options */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-12">
            {/* Support Email */}
            <div className="bg-card border border-border rounded-xl p-8 text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Support Questions</h3>
                  <p className="text-sm text-muted-foreground">Technical issues, account help, and more</p>
                </div>
              </div>
              <a
                href="mailto:help@jrnals.com"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
              >
                <Mail className="w-4 h-4" />
                help@jrnals.com
              </a>
            </div>

            {/* General Inquiries */}
            <div className="bg-card border border-border rounded-xl p-8 text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">General Inquiries</h3>
                  <p className="text-sm text-muted-foreground">Partnerships, press, and business</p>
                </div>
              </div>
              <a
                href="mailto:partnerships@jrnals.com"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
              >
                <Mail className="w-4 h-4" />
                partnerships@jrnals.com
              </a>
            </div>
          </div>

          {/* Social Media */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground mb-6">Follow Us</h3>
            <div className="flex justify-center gap-6">
              <a
                href="https://www.instagram.com/jrnals.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
                <span className="text-sm">Instagram</span>
              </a>
              <a
                href="https://x.com/jrnalscom"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                aria-label="X (formerly Twitter)"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-sm">X</span>
              </a>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
