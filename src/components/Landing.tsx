import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePricingDialog } from "@/contexts/PricingDialogContext";
import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Sparkles, Brain, Search, Star, Quote, PackageSearch, Code2, Telescope, Share2, RefreshCw, Paperclip, Eye, Globe, ArrowUp, MessageSquare, Pen, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

// Fade-in section component for scroll-triggered animations
const FadeInSection = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% of the element is visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn(
        "transition-all duration-[2400ms] ease-out",
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 translate-y-16",
        className
      )}
    >
      {children}
    </section>
  );
};

// Carousel component with auto-advance and progress bar
const ImageCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const images = [
    { id: 1, placeholder: "Image 1" },
    { id: 2, placeholder: "Image 2" },
    { id: 3, placeholder: "Image 3" },
  ];
  const duration = 8000; // 8 seconds per image

  // Intersection Observer for scroll-triggered fade-in
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.2 } // Trigger when 20% of the element is visible
    );

    if (carouselRef.current) {
      observer.observe(carouselRef.current);
    }

    return () => {
      if (carouselRef.current) {
        observer.unobserve(carouselRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
          return 0;
        }
        return prev + 1.25; // Increment by 1.25% every 100ms (100ms * 80 = 8000ms)
      });
    }, 100);

    return () => clearInterval(interval);
  }, [images.length, currentIndex]);

  // Reset progress when image changes
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setProgress(0);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setProgress(0);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setProgress(0);
  };

  return (
    <div 
      ref={carouselRef}
      className={cn(
        "relative w-full max-w-6xl mx-auto transition-all duration-[1200ms] ease-out",
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 translate-y-12"
      )}
    >
      {/* Title and Subtitle */}
      <div className="text-center mb-8">
        <h2 className="text-4xl md:text-5xl font-medium text-gray-900 mb-2">Jrnals is for Learning</h2>
        <p className="text-lg text-gray-600 mb-6">A learning partner in every journal</p>
        
        {/* Carousel Navigation */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={goToPrevious}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentIndex ? "bg-gray-900 w-8" : "bg-gray-400"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
          <button
            onClick={goToNext}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5 text-gray-700" />
          </button>
        </div>
        
        <p className="text-base text-gray-600">An extra set of eyes to always hit your quality bar</p>
      </div>

      {/* Image Container */}
      <div className="relative rounded-xl shadow-2xl overflow-hidden bg-white">
        <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
          <div className="text-gray-400 text-lg">{images[currentIndex].placeholder}</div>
          
          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
            <div
              className="h-full bg-gray-900 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Constant words array to prevent re-creation on every render
const ANIMATED_WORDS = ['Learn', 'Plan', 'Chat'] as const;

// Animated word component that cycles through words with type-in and fade out
const AnimatedWord = ({ words }: { words: readonly string[] }) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const currentIndexRef = useRef(0);
  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cycleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const wordsRef = useRef(words);

  // Update words ref when words change
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    if (words.length === 0) return;

    // Clean up all intervals and timeouts
    const cleanup = () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
        typeIntervalRef.current = null;
    }
      if (cycleTimeoutRef.current) {
        clearTimeout(cycleTimeoutRef.current);
        cycleTimeoutRef.current = null;
      }
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
    }
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };

    // Clean up first to prevent overlaps
    cleanup();

    // Prevent re-initialization if already active (atomic check-and-set)
    if (isActiveRef.current) {
      return () => {
        // Only clean up if we're not the active instance
        cleanup();
      };
    }
    
    // Mark as active immediately to prevent concurrent initializations
    isActiveRef.current = true;

    // Helper function to type a word character by character
    const typeWord = (word: string) => {
      if (!word) return;
      
      // Double-check we're still active before starting
      if (!isActiveRef.current) return;
      
      // Clear any existing type interval before starting new one
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
        typeIntervalRef.current = null;
      }
      
      setIsVisible(true);
      setIsTyping(true);
      setDisplayText('');
      
      // Use a closure variable to track character index
      let charIndex = 0;
      const wordToType = word; // Capture word in closure
      
      // Start typing immediately - no delay needed
      typeIntervalRef.current = setInterval(() => {
        if (!isActiveRef.current) {
          if (typeIntervalRef.current) {
            clearInterval(typeIntervalRef.current);
            typeIntervalRef.current = null;
          }
          return;
        }
        
        if (charIndex < wordToType.length) {
          setDisplayText(wordToType.slice(0, charIndex + 1));
          charIndex++;
        } else {
          setIsTyping(false);
          if (typeIntervalRef.current) {
            clearInterval(typeIntervalRef.current);
            typeIntervalRef.current = null;
          }
          
          // Schedule next transition after word is fully typed and displayed
          const displayTime = 3000; // Display completed word for 3 seconds
          cycleTimeoutRef.current = setTimeout(() => {
            if (isActiveRef.current) {
              transitionToNext();
            }
          }, displayTime);
        }
      }, 50); // Type each character every 50ms
    };

    // Function to transition to next word
    const transitionToNext = () => {
      if (!isActiveRef.current) return;
      
      // Clear any pending timeouts
      if (cycleTimeoutRef.current) {
        clearTimeout(cycleTimeoutRef.current);
        cycleTimeoutRef.current = null;
      }
      
      // Step 1: Fade out current text
      setIsVisible(false);
      setIsTyping(false);

      // Step 2: After fade completes, clear text and start typing new word
      fadeTimeoutRef.current = setTimeout(() => {
        if (!isActiveRef.current) return;
        
        const currentWords = wordsRef.current;
        const nextIndex = (currentIndexRef.current + 1) % currentWords.length;
        currentIndexRef.current = nextIndex;
        const nextWord = currentWords[nextIndex];
        
        // Step 3: Start typing new word
        if (fadeTimeoutRef.current) {
          fadeTimeoutRef.current = null;
        }
        typeWord(nextWord);
      }, 300); // Wait for fade out transition (duration matches CSS transition)
    };

    // Initialize with first word - use requestAnimationFrame to ensure DOM is ready
    currentIndexRef.current = 0;
    
    // Use requestAnimationFrame (double-RAF pattern) to ensure we're past initial render
    // This prevents glitches from React Strict Mode double-mounting
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Double-check we're still active and not already typing
        if (isActiveRef.current && !typeIntervalRef.current) {
          typeWord(words[0]);
        }
      });
    });

    return () => {
      cleanup();
      isActiveRef.current = false;
    };
  }, [words]);

  // Calculate the maximum width needed to keep "with your notes" in same position
  const maxWidth = words.length > 0 ? Math.max(...words.map(word => {
    return word.length * 0.6;
  })) + 'em' : 'auto';

  return (
    <span
      className={cn(
        "inline-block transition-opacity duration-300 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0"
      )}
      style={{
        display: 'inline-block',
        width: maxWidth,
        textAlign: 'right',
        verticalAlign: 'baseline',
        marginRight: 0,
        paddingRight: 0,
        marginLeft: 0,
        paddingLeft: 0
      }}
    >
      {displayText}
      {isTyping && <span className="animate-pulse ml-0.5">|</span>}
    </span>
  );
};

export const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
  const [videoOpacity, setVideoOpacity] = useState({ video1: 1, video2: 0 });
  const [whiteOverlayOpacity, setWhiteOverlayOpacity] = useState(0);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  

  // Handle smooth video loop with crossfade
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    let currentVideo = 1;
    const fadeTime = 1.5; // Start fade 1.5 seconds before end

    const updateFade = () => {
      const activeVideo = currentVideo === 1 ? video1 : video2;
      const nextVideo = currentVideo === 1 ? video2 : video1;

      if (activeVideo.duration && activeVideo.currentTime >= activeVideo.duration - fadeTime) {
        // Calculate fade progress (0 to 1 over fadeTime seconds)
        const timeUntilEnd = activeVideo.duration - activeVideo.currentTime;
        const fadeProgress = Math.min(1, Math.max(0, 1 - (timeUntilEnd / fadeTime)));
        
        if (currentVideo === 1) {
          setVideoOpacity({ video1: 1 - fadeProgress, video2: fadeProgress });
        } else {
          setVideoOpacity({ video1: fadeProgress, video2: 1 - fadeProgress });
        }

        // Start next video when we're halfway through the fade
        if (fadeProgress >= 0.5 && nextVideo.paused) {
          nextVideo.currentTime = 0;
          nextVideo.play().catch(() => {});
        }
      }
    };

    const handleVideo1TimeUpdate = () => {
      if (currentVideo === 1) updateFade();
    };

    const handleVideo2TimeUpdate = () => {
      if (currentVideo === 2) updateFade();
    };

    const handleVideo1End = () => {
      if (currentVideo === 1) {
        // Fade to white first - pause both videos for clean transition
        setWhiteOverlayOpacity(1);
        video1.pause();
        video2.pause();
        
        // After brief white pause, reset and fade back to video start
        setTimeout(() => {
          video1.currentTime = 0;
          video2.currentTime = 0;
          setVideoOpacity({ video1: 1, video2: 0 });
          setWhiteOverlayOpacity(0);
          // Start playing after fade back begins
          setTimeout(() => {
            video1.play().catch(() => {});
          }, 100);
          currentVideo = 1; // Reset to video1
        }, 500); // 500ms white pause
      }
    };

    const handleVideo2End = () => {
      if (currentVideo === 2) {
        // Fade to white first - pause both videos for clean transition
        setWhiteOverlayOpacity(1);
        video1.pause();
        video2.pause();
        
        // After brief white pause, reset and fade back to video start
        setTimeout(() => {
          video1.currentTime = 0;
          video2.currentTime = 0;
          setVideoOpacity({ video1: 0, video2: 1 });
          setWhiteOverlayOpacity(0);
          // Start playing after fade back begins
          setTimeout(() => {
            video2.play().catch(() => {});
          }, 100);
          currentVideo = 2; // Reset to video2
        }, 500); // 500ms white pause
      }
    };

    video1.addEventListener('timeupdate', handleVideo1TimeUpdate);
    video2.addEventListener('timeupdate', handleVideo2TimeUpdate);
    video1.addEventListener('ended', handleVideo1End);
    video2.addEventListener('ended', handleVideo2End);

    // Start video 1
    video1.play().catch(() => {});

    return () => {
      video1.removeEventListener('timeupdate', handleVideo1TimeUpdate);
      video2.removeEventListener('timeupdate', handleVideo2TimeUpdate);
      video1.removeEventListener('ended', handleVideo1End);
      video2.removeEventListener('ended', handleVideo2End);
    };
  }, []);

  const handleWelcomeClose = () => {
    setShowWelcomeDialog(false);
  };
  // Scroll to top on mount
  useEffect(() => {
    // Always start at the top when component mounts
    window.scrollTo(0, 0);
  }, []);

  // Handle hash navigation (only if hash exists)
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          el.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }, 100);
      }
    }
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
  return (
    <>
      <Dialog open={showWelcomeDialog} onOpenChange={handleWelcomeClose}>
        <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl bg-white [&>button]:hidden">
          <div className="flex relative">
            {/* Left Section - Text Content (2/3 width) */}
            <div className="flex-1 p-12 flex flex-col justify-between" style={{ width: '66.666%' }}>
              <div className="space-y-6">
                <h1 className="text-4xl font-medium text-gray-900">Welcome to Jrnals</h1>
                <p className="text-lg text-gray-900">
                  The AI journal for students that lets you chat, write and learn with all your work.
                </p>
                
                <div className="space-y-4 pt-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-gray-900 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-900">
                      <strong>Chat</strong> with your work effortlessly.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Pen className="h-5 w-5 text-gray-900 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-900">
                      <strong>Write</strong> with an editor using context from notes.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-gray-900 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-900">
                      <strong>Learn</strong> with a tutor in every journal.
                    </p>
                  </div>
                </div>
                
                <p className="text-gray-900 pt-2">
                  When it comes to AI, context makes all the difference.
                </p>
              </div>
              
              <Button
                onClick={handleWelcomeClose}
                className="w-full text-white rounded-lg py-6 text-base font-medium flex items-center justify-center gap-2 mt-8"
                style={{ backgroundColor: '#0d0d0d' }}
              >
                Let's Go
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Right Section - Placeholder Image (1/3 width) */}
            <div className="relative overflow-hidden" style={{ width: '33.333%' }}>
              <div className="h-full w-full flex items-center justify-center bg-gray-100">
                <div className="text-gray-400 text-sm">Placeholder</div>
              </div>
              {/* Border that cuts the image in half from the right */}
              <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white shadow-lg" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      <main>
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden" style={{ marginTop: 0 }}>
        {/* Video Background with Crossfade Loop */}
        <div className="relative w-full z-0">
          <video
            ref={video1Ref}
            muted
            playsInline
            className="w-full h-auto transition-opacity duration-1000"
            style={{ opacity: videoOpacity.video1, display: 'block' }}
          >
            <source src="/videos/light-bg-landing.mp4" type="video/mp4" />
          </video>
          <video
            ref={video2Ref}
            muted
            playsInline
            className="w-full h-auto absolute top-0 left-0 transition-opacity duration-1000"
            style={{ opacity: videoOpacity.video2, display: 'block', width: '100%' }}
          >
            <source src="/videos/light-bg-landing.mp4" type="video/mp4" />
          </video>
          
          {/* White overlay for video transitions */}
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
            style={{
              backgroundColor: 'white',
              opacity: whiteOverlayOpacity,
              zIndex: 4
            }}
          />
          
          {/* Fade to white overlay at bottom */}
          <div 
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: '300px',
              background: 'linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.3) 50%, white 100%)',
              zIndex: 5
            }}
          />
        </div>
        
        {/* Content Overlay - Centered */}
        <div className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-none">
          <div className="container px-8 text-center pointer-events-auto">
            <p className="text-lg md:text-xl text-gray-600 mb-4">Context for Education</p>
            
            <h1 className="font-medium text-foreground mb-8 max-w-5xl mx-auto whitespace-nowrap" style={{ fontFamily: "'Grotesk S SH Bold', sans-serif", minHeight: '4rem' }}>
              <span className="inline-flex items-baseline text-5xl md:text-6xl lg:text-7xl gap-0" style={{ gap: 0 }}>
                <AnimatedWord words={ANIMATED_WORDS} />
                <span className="text-foreground whitespace-nowrap">&nbsp;with your notes</span>
              </span>
            </h1>

            <div className="flex justify-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="bg-foreground text-background hover:bg-foreground/90 rounded-full">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Image Carousel Section */}
      <section id="first-learning-section" className="container px-8 py-20">
        <ImageCarousel />
      </section>

      {/* Reviews Section */}
      <FadeInSection className="w-full py-16">
        <p className="text-4xl md:text-5xl font-medium text-gray-900 text-center mb-6">
          Jrnals is for You
        </p>
        <div className="relative overflow-hidden py-8 marquee-edge-fade">
          <div className="flex min-w-max items-center gap-6 pr-16" style={{ animation: 'marquee 16s linear infinite' }}>
            {[
              { text: "Jrnals cuts the busywork. With just a prompt, I find sources quickly.", name: "Alex", title: "Student of Harvard" },
              { text: "Personalization in Jrnals is a secret weapon to stay pitch perfect.", name: "Sarah", title: "Student of Yale" },
              { text: "I make new journals all the time. Jrnals helps me solve problems fast.", name: "Mike", title: "Student of Princeton" },
              { text: "Jrnals helps me organize content for my classes and suggests better structures.", name: "Emma", title: "Student of Columbia" },
              { text: "Jrnals is my tutor: it answers questions in-line and gives me practice problems.", name: "Jordan", title: "Student of Melbourne University" },
              { text: "Jrnals helped me pick the right study method, comparing options with context.", name: "Taylor", title: "Student of Sydney University" },
            ].concat([
              { text: "Jrnals cuts the busywork. With just a prompt, I find sources quickly.", name: "Alex", title: "Student of Harvard" },
              { text: "Personalization in Jrnals is a secret weapon to stay pitch perfect.", name: "Sarah", title: "Student of Yale" },
              { text: "I make new journals all the time. Jrnals helps me solve problems fast.", name: "Mike", title: "Student of Princeton" },
              { text: "Jrnals helps me organize content for my classes and suggests better structures.", name: "Emma", title: "Student of Columbia" },
              { text: "Jrnals is my tutor: it answers questions in-line and gives me practice problems.", name: "Jordan", title: "Student of Melbourne University" },
              { text: "Jrnals helped me pick the right study method, comparing options with context.", name: "Taylor", title: "Student of Sydney University" },
            ]).map((review, index) => (
              <div key={`review-${index}`} className="flex-shrink-0 w-80 h-64 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <p className="text-lg text-gray-700 mb-4 leading-relaxed line-clamp-3">{review.text}</p>
                <div className="mt-auto">
                    <p className="text-sm font-medium text-gray-900">{review.name}</p>
                    <p className="text-xs text-gray-500">{review.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeInSection>


      <SiteFooter />

      </main>
    </div>
    </>
  );
};