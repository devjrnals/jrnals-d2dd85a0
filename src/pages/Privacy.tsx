import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function Privacy() {
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
            <Shield className="w-3 h-3 mr-1" />
            Privacy
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 max-w-3xl mx-auto">
            Privacy Policy
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </section>

        {/* Privacy Content */}
        <section className="container px-8 pb-20">
          <div className="max-w-4xl mx-auto prose prose-lg">
            <h2>1. Information We Collect</h2>

            <h3>1.1 Personal Information</h3>
            <p>We may collect the following types of personal information:</p>
            <ul>
              <li>Name and email address when you create an account</li>
              <li>Payment information for subscription services</li>
              <li>Usage data and preferences</li>
              <li>Communications with our support team</li>
            </ul>

            <h3>1.2 Educational Content</h3>
            <p>
              When you upload educational materials to Jrnals, we process and store this content to provide our AI-powered
              learning features. This includes PDFs, documents, notes, and other study materials.
            </p>

            <h3>1.3 Usage Data</h3>
            <p>
              We automatically collect information about how you use our service, including:
            </p>
            <ul>
              <li>Features used and time spent</li>
              <li>Device and browser information</li>
              <li>IP address and location data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul>
              <li>Provide and maintain our AI-powered learning platform</li>
              <li>Process and analyze your educational content</li>
              <li>Improve our AI models and service features</li>
              <li>Communicate with you about your account and our services</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Process payments and manage subscriptions</li>
              <li>Ensure security and prevent fraud</li>
            </ul>

            <h2>3. Information Sharing and Disclosure</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            <ul>
              <li>With your explicit consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and prevent fraud</li>
              <li>With trusted service providers who assist our operations (under strict confidentiality agreements)</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your personal information
              against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers,
              and regular security assessments.
            </p>

            <h2>5. AI Processing and Content Analysis</h2>
            <p>
              Your educational content is processed by our AI systems to provide features like summaries, quizzes, and
              interactive learning tools. This processing helps us understand context and generate relevant study materials.
              We do not use your content to train general-purpose AI models that could be used by other companies.
            </p>

            <h2>6. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide our services and comply with legal
              obligations. You can request deletion of your account and associated data at any time.
            </p>

            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access and review your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent where applicable</li>
            </ul>

            <h2>8. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze usage patterns, and provide
              personalized features. You can control cookie settings through your browser preferences.
            </p>

            <h2>9. Third-Party Services</h2>
            <p>
              Our service may contain links to third-party websites or integrate with third-party services.
              We are not responsible for the privacy practices of these external services.
            </p>

            <h2>10. Children's Privacy</h2>
            <p>
              Our service is intended for users who are at least 13 years old. We do not knowingly collect personal
              information from children under 13. If we become aware of such collection, we will delete the information promptly.
            </p>

            <h2>11. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate
              safeguards are in place to protect your data during such transfers.
            </p>

            <h2>12. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email
              or through our service. Your continued use of Jrnals constitutes acceptance of the updated policy.
            </p>

            <h2>13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us at{" "}
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
