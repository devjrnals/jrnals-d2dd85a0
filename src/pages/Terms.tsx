import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function Terms() {
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
            <FileText className="w-3 h-3 mr-1" />
            Legal
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 max-w-3xl mx-auto">
            Terms of Service
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </section>

        {/* Terms Content */}
        <section className="container px-8 pb-20">
          <div className="max-w-4xl mx-auto prose prose-lg">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Jrnals ("we," "us," or "our"), you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Jrnals is an AI-powered learning platform that transforms educational materials into interactive study tools,
              including summaries, quizzes, flashcards, and chat-based learning assistance.
            </p>

            <h2>3. User Accounts</h2>
            <p>
              To access certain features of our service, you may be required to create an account. You are responsible for:
            </p>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>

            <h2>4. Acceptable Use Policy</h2>
            <p>You agree not to use our service to:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Upload harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt our service</li>
            </ul>

            <h2>5. Content Ownership</h2>
            <p>
              You retain ownership of the educational materials you upload to our platform. By using our service,
              you grant us a limited license to process and analyze your content to provide our AI-powered features.
            </p>

            <h2>6. Privacy and Data Protection</h2>
            <p>
              Your privacy is important to us. Please review our Privacy Policy, which also governs your use of Jrnals,
              to understand our practices regarding the collection and use of your personal information.
            </p>

            <h2>7. Payment Terms</h2>
            <p>
              Some features of our service require payment. All fees are non-refundable unless otherwise specified.
              We reserve the right to change our pricing at any time with reasonable notice.
            </p>

            <h2>8. Termination</h2>
            <p>
              We may terminate or suspend your account and access to our service immediately, without prior notice,
              for any reason, including breach of these Terms.
            </p>

            <h2>9. Disclaimer of Warranties</h2>
            <p>
              Our service is provided "as is" without warranties of any kind. We do not guarantee that our service
              will be uninterrupted, error-free, or meet your specific requirements.
            </p>

            <h2>10. Limitation of Liability</h2>
            <p>
              In no event shall Jrnals be liable for any indirect, incidental, special, consequential, or punitive
              damages arising out of or related to your use of our service.
            </p>

            <h2>11. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction
              in which Jrnals operates, without regard to its conflict of law provisions.
            </p>

            <h2>12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of significant changes
              via email or through our service. Continued use of our service constitutes acceptance of the modified terms.
            </p>

            <h2>13. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at{" "}
              <a href="mailto:help@jrnals.com" className="text-primary hover:underline">
                help@jrnals.com
              </a>
              .
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
