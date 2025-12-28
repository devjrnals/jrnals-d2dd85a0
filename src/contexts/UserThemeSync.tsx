import React, { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";

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

    // For now, keep the current theme when logged in
    // Theme persistence requires adding a 'theme' column to profiles table
  }, [loading, user?.id]);

  return <>{children}</>;
}
