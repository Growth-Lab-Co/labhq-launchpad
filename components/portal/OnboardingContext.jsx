"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [account, setAccount] = useState(undefined); // undefined = loading, null = signed out

  const refetchAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/session");
      const data = await res.json();
      setAccount(data.account || null);
      return data.account || null;
    } catch {
      setAccount(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refetchAccount();
  }, [refetchAccount]);

  return (
    <OnboardingContext.Provider value={{ account, refetchAccount }}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
