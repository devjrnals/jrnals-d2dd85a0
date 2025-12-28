import { Landing } from "@/components/Landing";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  useEffect(() => {
    // Track visitor count - only increment once per session
    const visitorTracked = sessionStorage.getItem('visitorTracked');
    if (!visitorTracked) {
      supabase.rpc('increment_visitor_count').then(() => {
        sessionStorage.setItem('visitorTracked', 'true');
      }).catch((error) => {
        // Silently handle if function/table doesn't exist yet
        console.log('Visitor tracking not available yet:', error.message);
      });
    }
  }, []);

  return <Landing />;
};

export default Index;
