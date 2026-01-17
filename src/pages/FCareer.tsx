import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function FCareer() {
  const navigate = useNavigate();

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
            <Briefcase className="w-3 h-3 mr-1" />
            Join Our Team
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 max-w-3xl mx-auto">
            Help us build the future of learning
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            We're building the workspace where your best thinking and learning happen seamlessly. Join us in bringing it to learners and writers everywhere.
          </p>

          {/* Open Positions */}
          <div className="max-w-2xl mx-auto space-y-4 mb-12">
            <div
              className="w-full bg-muted/50 border border-border rounded-xl p-6 flex items-center justify-between text-left cursor-default"
            >
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Growth Intern</h3>
                <p className="text-sm text-muted-foreground">Marketing • Remote • Part-time</p>
              </div>
              <span className="text-sm text-muted-foreground flex-shrink-0">Closed</span>
            </div>

            <div
              className="w-full bg-muted/50 border border-border rounded-xl p-6 flex items-center justify-between text-left cursor-default"
            >
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">UGC Creator</h3>
                <p className="text-sm text-muted-foreground">Marketing • Remote • Part-time</p>
              </div>
              <span className="text-sm text-muted-foreground flex-shrink-0">Closed</span>
            </div>
          </div>

          {/* Open Positions CTA */}
          <div className="text-center">
            <p className="text-lg text-muted-foreground mb-6">
              Interested in joining our team? We'd love to hear from you.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/contact")}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full"
            >
              Get in Touch
            </Button>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}

