"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import styles from "./checkout-success.module.css";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 20; // ~40s of active polling before settling on the calm fallback

export function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState("checking"); // checking | failed | unpaid | missing
  const attemptsRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setState("missing");
      return;
    }
    cancelledRef.current = false;

    async function poll() {
      attemptsRef.current += 1;
      try {
        const res = await fetch("/api/miia/checkout/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (cancelledRef.current) return;

        if (data.status === "success" && data.tenantSlug) {
          window.location.href = `/${data.tenantSlug}`;
          return;
        }
        if (data.status === "unpaid") {
          setState("unpaid");
          return;
        }
        if (data.status === "failed" || attemptsRef.current >= MAX_POLLS) {
          setState("failed");
          return;
        }
        // pending - try again
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (cancelledRef.current) return;
        if (attemptsRef.current >= MAX_POLLS) {
          setState("failed");
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    poll();

    return () => {
      cancelledRef.current = true;
    };
  }, [sessionId]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Image src="/miia-app-icon.png" alt="" width={56} height={56} style={{ borderRadius: 16 }} />

        {state === "checking" && (
          <>
            <div className={styles.pulseRow} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h1 className={styles.heading}>Setting up your space</h1>
            <p className={styles.body}>Give us a moment while Miia gets your front desk ready.</p>
          </>
        )}

        {(state === "failed" || state === "unpaid") && (
          <>
            <h1 className={styles.heading}>Miia&apos;s getting your space ready</h1>
            <p className={styles.body}>
              We&apos;ll email you within the hour once it&apos;s done. Thanks for your patience, and thanks for
              trusting us with your front desk.
            </p>
            <Button href="/" className={styles.cta}>
              Back to Miia
            </Button>
          </>
        )}

        {state === "missing" && (
          <>
            <h1 className={styles.heading}>We couldn&apos;t find that checkout</h1>
            <p className={styles.body}>If you just paid, check your email for confirmation, or try again below.</p>
            <Button href="/get-started" className={styles.cta}>
              {PRIMARY_CTA_LABEL}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
