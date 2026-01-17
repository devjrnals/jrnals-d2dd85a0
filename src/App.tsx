import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import Folder from "./pages/Folder";
import SharedJournal from "./pages/SharedJournal";
import Auth from "./pages/Auth";
import { AuthCallback } from "./pages/AuthCallback";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import FCareer from "./pages/FCareer";
import { Contact } from "./pages/Contact";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { Blog } from "./pages/Blog";
import { ReleaseNotes } from "./pages/ReleaseNotes";
import { Landing } from "@/components/Landing";
import { PricingDialogProvider } from "@/contexts/PricingDialogContext";
import { UserThemeSync } from "@/contexts/UserThemeSync";

const queryClient = new QueryClient();

// Component to scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppContent = () => {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<Landing />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/careers" element={<FCareer />} />
      <Route path="/release-notes" element={<ReleaseNotes />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/journal/:id" element={
        <div className="signed-in-theme flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <Journal />
        </div>
      } />
      <Route path="/folder/:folderId" element={
        <div className="signed-in-theme flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <Folder />
        </div>
      } />
      <Route path="/shared/:shareId" element={<SharedJournal />} />
      <Route path="/profile" element={
        <div className="signed-in-theme flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <Profile />
        </div>
      } />
      <Route path="/settings" element={
        <div className="signed-in-theme flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <Settings />
        </div>
      } />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <PricingDialogProvider>
          <UserThemeSync>
            <AppContent />
          </UserThemeSync>
        </PricingDialogProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
