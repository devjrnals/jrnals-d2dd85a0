import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/journal/:id" element={
        <div className="signed-in-theme flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <Journal />
        </div>
      } />
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
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
