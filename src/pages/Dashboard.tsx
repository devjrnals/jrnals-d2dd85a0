import { Sidebar } from "@/components/Sidebar";
import { Home } from "@/components/Home";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleSidebarLoadComplete = useCallback(() => {
    // Callback for sidebar load complete if needed in the future
  }, []);

  const handleHomeLoadComplete = useCallback(() => {
    // Callback for home load complete if needed in the future
  }, []);

  if (loading || !user) {
    return (
      <div className="signed-in-theme flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="signed-in-theme flex h-screen overflow-hidden bg-background relative">
      <Sidebar onLoadComplete={handleSidebarLoadComplete} />
      <Home onLoadComplete={handleHomeLoadComplete} />
    </div>
  );
};

export default Dashboard;
