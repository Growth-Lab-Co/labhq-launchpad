"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ui";
import { OnboardingProvider, useOnboarding } from "@/components/portal/OnboardingContext";
import s from "./onboarding.module.css";

export const STEPS = [
  { key: "activate", label: "Activate", done: (o) => o.activated },
  { key: "connect", label: "Connect GoHighLevel", done: (o) => o.ghlAgencyConnected && o.ghlLocationConnected },
  { key: "snapshot", label: "Import the snapshot", done: (o) => Boolean(o.snapshotId) },
  { key: "brand", label: "Brand your door", done: (o) => o.brandingDone },
];

export default function OnboardingLayout({ children }) {
  return (
    <OnboardingProvider>
      <OnboardingGate>{children}</OnboardingGate>
    </OnboardingProvider>
  );
}

function OnboardingGate({ children }) {
  const { account } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();
  const currentKey = pathname.split("/").pop();

  const firstIncompleteIndex = account && account !== null ? STEPS.findIndex((step) => !step.done(account.onboarding)) : -1;
  const allDone = account && firstIncompleteIndex === -1;

  useEffect(() => {
    if (account === undefined) return; // still loading
    if (account === null) {
      router.replace("/portal");
      return;
    }
    if (account.onboarding.completedAt) {
      router.replace("/portal/dashboard");
      return;
    }
    if (pathname === "/portal/onboarding") {
      router.replace(`/portal/onboarding/${STEPS[firstIncompleteIndex]?.key || "complete"}`);
      return;
    }
    if (currentKey === "complete") {
      if (!allDone) router.replace(`/portal/onboarding/${STEPS[firstIncompleteIndex]?.key}`);
      return;
    }
    const requestedIndex = STEPS.findIndex((step) => step.key === currentKey);
    if (requestedIndex > firstIncompleteIndex) {
      router.replace(`/portal/onboarding/${STEPS[firstIncompleteIndex]?.key}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, pathname]);

  if (account === undefined || account === null) {
    return (
      <main className={s.shell}>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
      </main>
    );
  }

  const activeIndex = STEPS.findIndex((step) => step.key === currentKey);
  const completedCount = STEPS.filter((step) => step.done(account.onboarding)).length;

  return (
    <main className={s.shell}>
      <div className={s.header}>
        <Link href="/" className={`${s.wordmark} font-display`}>
          Lab HQ
        </Link>
        {activeIndex >= 0 && (
          <p className={s.stepLabel}>
            Step {activeIndex + 1} of {STEPS.length}: {STEPS[activeIndex].label}
          </p>
        )}
        <ProgressBar value={completedCount} max={STEPS.length} aria-label="Onboarding progress" />
      </div>
      {children}
    </main>
  );
}
