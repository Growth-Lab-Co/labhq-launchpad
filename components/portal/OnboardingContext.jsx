"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [account, setAccount] = useState(undefined); // undefined = loading, null = signed out
  // Set by a step page right before it navigates itself to /complete and
  // then refetches the account. next/navigation's router.replace() doesn't
  // synchronously update what usePathname() reports, so the shared gate's
  // reactive "already fully done -> send to dashboard" redirect (meant for
  // someone RETURNING to the wizard later) can otherwise fire using the
  // still-stale pathname before that explicit navigation has taken effect,
  // racing it to /portal/dashboard instead of the success screen. This lets
  // the gate know to sit out one redirect while that's in flight.
  const finishingRef = useRef(false);

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
    <OnboardingContext.Provider value={{ account, refetchAccount, finishingRef }}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
