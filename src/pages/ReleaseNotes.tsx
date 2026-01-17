import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function ReleaseNotes() {
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
            <Sparkles className="w-3 h-3 mr-1" />
            Product Updates
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 max-w-3xl mx-auto">
            Release Notes
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Stay up to date with the latest features and improvements to Jrnals.
          </p>
        </section>

        {/* Release Notes Content */}
        <section className="container px-8 pb-20">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* Example Release Note */}
            <div className="border-b border-gray-200 pb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-2xl font-semibold text-foreground">Version 1.0.0</h2>
                <Badge variant="outline" className="text-xs">
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Badge>
              </div>
              
              <div className="space-y-4 text-gray-700">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">✨ New Features</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>AI-powered journal creation and editing</li>
                    <li>Web search integration for enhanced context</li>
                    <li>Document upload and processing support</li>
                    <li>Real-time collaborative editing</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">🔧 Improvements</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Enhanced user interface and navigation</li>
                    <li>Improved search functionality</li>
                    <li>Better mobile responsiveness</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">🐛 Bug Fixes</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Fixed issue with document processing</li>
                    <li>Resolved navigation routing problems</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Placeholder for future releases */}
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>More release notes coming soon!</p>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}

