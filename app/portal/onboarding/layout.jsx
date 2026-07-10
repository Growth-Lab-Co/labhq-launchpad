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
  const { account, finishingRef } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();
  const currentKey = pathname.split("/").pop();

  const firstIncompleteIndex = account && account !== null ? STEPS.findIndex((step) => !step.done(account.onboarding)) : -1;

  useEffect(() => {
    if (account === undefined) return; // still loading
    if (account === null) {
      router.replace("/portal");
      return;
    }
    const complete = Boolean(account.onboarding.completedAt);

    if (pathname === "/portal/onboarding") {
      router.replace(complete ? "/portal/dashboard" : `/portal/onboarding/${STEPS[firstIncompleteIndex].key}`);
      return;
    }
    // /complete is exactly where a freshly-completed account should land -
    // never bounce away from it just because completedAt is now true. Only
    // send someone away from it if they deep-linked here before actually
    // finishing.
    if (currentKey === "complete") {
      finishingRef.current = false; // the transition it was guarding against has landed
      if (!complete) router.replace(`/portal/onboarding/${STEPS[firstIncompleteIndex].key}`);
      return;
    }
    // Any other step page with an already-fully-done account normally means
    // someone returning to the wizard later - except right after finishing
    // the last step, where the account can flip to complete while
    // usePathname() still briefly reports the step page itself (router.
    // replace's URL update isn't synchronous with the state update that
    // caused it). finishingRef distinguishes the two so this doesn't race
    // that step's own navigation to /complete.
    if (complete && !finishingRef.current) {
      router.replace("/portal/dashboard");
      return;
    }
    if (complete) return; // finishing in progress - the step page's own navigation will land
    const requestedIndex = STEPS.findIndex((step) => step.key === currentKey);
    if (requestedIndex > firstIncompleteIndex) {
      router.replace(`/portal/onboarding/${STEPS[firstIncompleteIndex].key}`);
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
