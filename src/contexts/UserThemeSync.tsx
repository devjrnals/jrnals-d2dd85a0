import React, { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function UserThemeSync({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (loading) return;

    // Logged out: always use light mode (Auth + marketing should never inherit a previous user's dark mode).
    if (!user) {
      if (theme !== "light") setTheme("light");
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("theme")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // Fail safe: keep the current theme if profile fetch fails.
        return;
      }

      const desired = data?.theme === "dark" ? "dark" : "light";
      if (theme !== desired) setTheme(desired);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]); // intentionally not depending on `theme` to avoid extra resync churn

  return <>{children}</>;
}



