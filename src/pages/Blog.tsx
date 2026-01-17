import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Blog = () => {
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Blog
            </h1>
            <p className="text-xl text-muted-foreground">
              Insights, updates, and stories from the Jrnals team
            </p>
          </div>

          {/* Blog content will go here */}
          <div className="space-y-12">
            <article className="border-b border-border pb-12">
              <div className="mb-6">
                <span className="text-sm text-primary font-medium">Coming Soon</span>
                <h2 className="text-2xl font-bold text-foreground mt-2 mb-3">
                  Welcome to Our Blog
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We're excited to share insights, tutorials, and updates about AI-powered learning,
                  educational technology, and the future of intelligent study tools. Stay tuned for
                  our first posts!
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>January 2, 2026</span>
                <span>•</span>
                <span>Jrnals Team</span>
              </div>
            </article>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};







