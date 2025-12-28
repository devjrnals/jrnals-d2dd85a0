import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import Folder from "./pages/Folder";
import SharedJournal from "./pages/SharedJournal";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import FCareer from "./pages/FCareer";
import ComingSoon from "./pages/ComingSoon";
import Admin from "./pages/Admin";
import { PricingDialogProvider } from "@/contexts/PricingDialogContext";
import { UserThemeSync } from "@/contexts/UserThemeSync";

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ComingSoon />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/fcareer" element={<FCareer />} />
      <Route path="/coming-soon" element={<ComingSoon />} />
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
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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
