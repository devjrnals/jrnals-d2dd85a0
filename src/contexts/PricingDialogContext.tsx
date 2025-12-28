import React, { createContext, useContext, useMemo, useState } from "react";
import { PremiumPanel } from "@/components/PremiumPanel";

type PricingDialogContextValue = {
  openPricing: () => void;
};

const PricingDialogContext = createContext<PricingDialogContextValue | null>(null);

export function PricingDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = useMemo<PricingDialogContextValue>(
    () => ({
      openPricing: () => setOpen(true),
    }),
    [],
  );

  return (
    <PricingDialogContext.Provider value={value}>
      {children}
      <PremiumPanel
        open={open}
        onClose={() => setOpen(false)}
        onUpgrade={(interval) => {
          // Keep consistent behavior with the previous Landing implementation.
          console.log("Upgrade clicked:", interval);
          setOpen(false);
        }}
      />
    </PricingDialogContext.Provider>
  );
}

export function usePricingDialog() {
  const ctx = useContext(PricingDialogContext);
  if (!ctx) throw new Error("usePricingDialog must be used within a PricingDialogProvider");
  return ctx;
}



