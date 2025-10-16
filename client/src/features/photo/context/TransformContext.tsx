import React, { createContext, useContext, useState } from "react";

export type TransformMode = "translate" | "rotate" | "scale";

type Ctx = { 
  mode: TransformMode; 
  setMode: (m: TransformMode) => void;
  calibrateMode: boolean;
  setCalibrateMode: (mode: boolean) => void;
};

const TransformContext = createContext<Ctx | null>(null);

export function TransformProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<TransformMode>("translate");
  const [calibrateMode, setCalibrateMode] = useState(false);

  return (
    <TransformContext.Provider value={{ mode, setMode, calibrateMode, setCalibrateMode }}>
      {children}
    </TransformContext.Provider>
  );
}

/**
 * Tolerant hook:
 * - If provider is missing, don't throw; return safe no-op context and warn once.
 *   This prevents an entire tab crash if someone forgets the provider.
 */
let warned = false;
export function useTransformMode(): Ctx {
  const ctx = useContext(TransformContext);
  if (!ctx) {
    if (!warned) {
      console.warn("[TransformContext] useTransformMode used without provider; falling back to no-op.");
      warned = true;
    }
    return { 
      mode: "translate", 
      setMode: () => {}, 
      calibrateMode: false, 
      setCalibrateMode: () => {} 
    };
  }
  return ctx;
}

export default TransformContext;
