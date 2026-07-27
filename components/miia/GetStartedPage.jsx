"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Reveal, RevealStagger } from "./Reveal";
import { Button } from "./Button";
import { PricingCards } from "./PricingCards";
import { getPlan } from "./plans";
import styles from "./get-started.module.css";

const STEPS = [
  { heading: "Pick your plan", body: "Chat, Everywhere or Complete. Change any time." },
  { heading: "Say hello", body: "Your 10 minute chat. Tell Miia about the business." },
  { heading: "Connect your channels", body: "A few clicks each. Website, socials, SMS, phone." },
  { heading: "She goes live", body: "Answering every enquiry, day and night, in your voice." },
];

const DEFAULT_PLAN = "everywhere";

export function GetStartedPage() {
  const searchParams = useSearchParams();
  const queryPlan = searchParams.get("plan");
  const initial = getPlan(queryPlan) ? queryPlan : DEFAULT_PLAN;
  const [selectedId, setSelectedId] = useState(initial);
  const [yearly, setYearly] = useState(searchParams.get("billing") === "yearly");
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState(null);

  async function startCheckout() {
    if (checkingOut) return;
    setCheckingOut(true);
    setError(null);
    try {
      const res = await fetch("/api/miia/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: selectedId, billingPeriod: yearly ? "yearly" : "monthly" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
      setCheckingOut(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Reveal className={styles.intro}>
          <h1 className={styles.h1}>Let&apos;s introduce you to Miia.</h1>
          <p>Four steps, most of them faster than making a coffee.</p>
        </Reveal>

        <RevealStagger className={styles.stepsRow} step={90}>
          {STEPS.map((step, i) => (
            <div className={styles.stepCard} key={step.heading}>
              <div className={styles.stepNum}>{String(i + 1).padStart(2, "0")}</div>
              <h3 className={styles.stepHeading}>{step.heading}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </div>
          ))}
        </RevealStagger>

        <Reveal className={styles.pickHead}>
          <h2 className={styles.pickHeading}>Pick your plan</h2>
          <p className={styles.pickSub}>You can switch plans any time from your dashboard.</p>
        </Reveal>

        <Reveal delay={80}>
          <PricingCards selectedId={selectedId} onSelect={setSelectedId} yearly={yearly} onYearlyChange={setYearly} />
        </Reveal>

        <div className={styles.ctaBlock}>
          <Reveal>
            <Button onClick={startCheckout} disabled={checkingOut}>
              {checkingOut ? "Taking you to checkout…" : "Start my 10 minute chat"}
            </Button>
            {error && <p className={styles.ctaError}>{error}</p>}
            <p className={styles.ctaNote}>48 hours from now, she&apos;s answering.</p>
            <p className={styles.ctaGuarantee}>Better than voicemail in 30 days or that month is refunded.</p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
