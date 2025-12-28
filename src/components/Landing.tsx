import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePricingDialog } from "@/contexts/PricingDialogContext";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Sparkles, Brain, Search, Star, Quote, PackageSearch, Code2, Telescope, Share2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import landingLogo from "@/assets/landing-logo.png";
import { SiteFooter } from "@/components/SiteFooter";
export const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    openPricing
  } = usePricingDialog();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, [location.hash]);

  // Auto-load *any* images placed in src/assets/partner-logos/
  // (filenames and university names don't matter).
  const partnerLogoModules = import.meta.glob("../assets/partner-logos/*.{png,jpg,jpeg,webp,svg}", {
    eager: true,
    query: "?url",
    import: "default"
  }) as Record<string, string>;
  const partnerLogoUrls = Object.values(partnerLogoModules);
  const partnerLogos = partnerLogoUrls.length > 0 ? partnerLogoUrls.map((src, i) => ({
    alt: `University logo ${i + 1}`,
    src
  })) : [
  // Fallback to repo-provided placeholders if no assets were added yet
  {
    alt: "Harvard",
    src: "/logos/harvard.svg"
  }, {
    alt: "MIT",
    src: "/logos/mit.svg"
  }, {
    alt: "Stanford",
    src: "/logos/stanford.svg"
  }, {
    alt: "Yale",
    src: "/logos/yale.svg"
  }, {
    alt: "Michigan",
    src: "/logos/michigan.svg"
  }, {
    alt: "Caltech",
    src: "/logos/caltech.svg"
  }];
  return <div className="min-h-screen bg-white text-gray-900" style={{
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
      {/* Header */}
      <header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-colors", "supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:saturate-150", isHeaderScrolled ? "border-border/70 bg-background/85 shadow-sm" : "border-transparent bg-background/55")}>
        <div className="container flex h-16 items-center justify-between px-8">
          <div className="flex items-center gap-8">
            <button type="button" className="flex items-center" aria-label="Go to home" onClick={() => window.scrollTo({
            top: 0,
            behavior: "smooth"
          })}>
              <img src={landingLogo} alt="Jrnals" className="h-7 w-auto" loading="eager" />
            </button>
            <nav className="hidden md:flex gap-6">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => navigate("/#features")}>
                Features
              </button>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={openPricing}>
                Pricing
              </button>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => navigate("/fcareer")}>
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
          Built by Students  
        </Badge>
        
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 max-w-3xl mx-auto">
          Context for Education
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
            {partnerLogos.concat(partnerLogos).map((logo, index) => <div key={`${logo.src}-${index}`} className="flex-shrink-0 px-4">
                <img src={logo.src} alt={logo.alt} loading="lazy" className="h-16 w-auto md:h-20 drop-shadow-sm" />
              </div>)}
          </div>
        </div>
      </section>

      {/* Trusted Students - Feature Showcase */}
      <section id="features" className="container px-8 py-20 scroll-mt-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 max-w-4xl mx-auto">
            Everything your agent needs, fully interactive through an API or MCP.
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Jrnals provides the context layer that makes AI coding agents actually useful.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
          {/* Large card 1 */}
          <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="rounded-xl border border-border overflow-hidden bg-muted">
              {/* TODO: Replace this placeholder with a video */}
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center px-8">
                  <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Video placeholder</p>
                </div>
              </div>
            </div>
            <div className="pt-6 px-1">
              <h3 className="text-lg font-semibold text-foreground">Universal Search</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Sub-5s responses across millions of indexed pages and GitHub files. Tiny AI models compress results
                in milliseconds for token-efficient answers.
              </p>
            </div>
          </div>

          {/* Large card 2 */}
          <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="rounded-xl border border-border overflow-hidden bg-muted">
              {/* TODO: Replace this placeholder with a video */}
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center px-8">
                  <PackageSearch className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Video placeholder</p>
                </div>
              </div>
            </div>
            <div className="pt-6 px-1">
              <h3 className="text-lg font-semibold text-foreground">Instant Package Search</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Search pre-indexed package docs like AI SDK for ground-truth code examples. Your agent never
                hallucinates.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Code2 className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Jrnals API</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Build custom agents and workflows tailored for your company using Jrnals&apos; API.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Telescope className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Oracle Research</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              SOTA search designed to reduce hallucinations. Turns indexed codebases into a dynamic tree your agent
              queries on the fly.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Share2 className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Context Sharing</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Save conversational histories, plans, and referenced sources. Resume in another agent without losing the
              thread.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Auto-Sync Sources</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Never rely on outdated docs. We continuously monitor and update your indexed sources automatically.
            </p>
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

      {/* Testimonials */}
      <section className="container px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Loved by students worldwide
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See what our users have to say about their learning experience
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Testimonial 1 */}
          <div className="bg-card border border-border rounded-xl p-8 relative">
            <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4" />
            <div className="flex mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              "Jrnals transformed how I study. The AI summaries and interactive quizzes helped me ace my finals. It's like having a personal tutor available 24/7."
            </p>
            <div className="flex items-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary">SA</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">Sarah Anderson</p>
                <p className="text-sm text-muted-foreground">Computer Science Student</p>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-card border border-border rounded-xl p-8 relative">
            <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4" />
            <div className="flex mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              "The chatbot feature is incredible. I can ask complex questions about my course materials and get detailed, referenced answers instantly. Game-changer!"
            </p>
            <div className="flex items-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary">MJ</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">Marcus Johnson</p>
                <p className="text-sm text-muted-foreground">Medical Student</p>
              </div>
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-card border border-border rounded-xl p-8 relative">
            <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4" />
            <div className="flex mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              "From PDF uploads to interactive learning, Jrnals covers everything. The organization features keep me on track with multiple courses and deadlines."
            </p>
            <div className="flex items-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary">EL</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">Emily Liu</p>
                <p className="text-sm text-muted-foreground">Engineering Student</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about Jrnals
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="what-is-tasklearn" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold">What is Jrnals?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pt-2">
                Jrnals is an AI-powered learning platform that transforms your course materials into interactive study tools. Upload PDFs, documents, or notes, and get AI-generated summaries, quizzes, flashcards, and chat with your content.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how-does-ai-work" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold">How does the AI assistant work?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pt-2">
                Our AI assistant, powered by GPT-4, analyzes your uploaded materials and provides intelligent responses to your questions. It can summarize complex topics, explain concepts, answer specific questions with references to your materials, and help you organize your thoughts.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="supported-formats" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold">What file formats are supported?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pt-2">
                Jrnals supports PDF documents, text files (.txt, .md), and various document formats. You can upload lecture notes, textbooks, articles, and any text-based learning materials. The AI will process and analyze the content to create study materials.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="is-it-free" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold">Is Jrnals free to use?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pt-2">
                Jrnals offers a free tier with basic features to get you started. Premium plans unlock advanced AI features, unlimited document uploads, and priority support. You can start learning immediately and upgrade when you're ready.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-privacy" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold">How secure is my data?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pt-2">
                Your privacy and data security are our top priorities. All uploaded materials are encrypted and stored securely. We don't share your personal information or course materials with third parties. Your learning data is used solely to improve your study experience.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="offline-access" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold">Can I access my materials offline?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pt-2">
                Jrnals is a web-based platform that requires an internet connection for the best experience. However, once your materials are processed, you can access summaries and notes even with slower connections. We're working on offline capabilities for future updates.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <SiteFooter />

      </main>
    </div>;
};