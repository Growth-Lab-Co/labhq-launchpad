"use client";
import { useState } from "react";
import { Card, CardEmpty } from "./Card";
import { CreditCard } from "lucide-react";
import styles from "./BillingPageClient.module.css";

// Only "replies a month" caps can be honestly compared against the usage
// count this page has (replies logged this month) - Miia Complete's cap is
// call minutes, which nothing in this codebase measures, so that plan gets
// no usage bar rather than a comparison against the wrong unit.
function parseReplyCap(repliesText) {
  const m = /^([\d,]+)\s+replies/.exec(repliesText || "");
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}

export function BillingPageClient({ tenantSlug, plan, founding, billingPeriod, usage, hasStripeCustomer, foundingDiscount }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const cap = plan ? parseReplyCap(plan.replies) : null;
  const showUsageBar = cap != null && usage != null;

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/miia/dashboard/billing-portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't open billing.");
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  }

  async function confirmCancel() {
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch("/api/miia/dashboard/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't cancel.");
      setCancelled(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1 className={styles.heading}>Billing</h1>

      {!plan ? (
        <Card>
          <CardEmpty icon={CreditCard} title="No plan found" body="Reach out and we'll sort out your billing details." />
        </Card>
      ) : (
        <div className={styles.card}>
          <div className={styles.planRow}>
            <span className={styles.planName}>{plan.name}</span>
            {founding && <span className={styles.badge}>Founding: {foundingDiscount}</span>}
          </div>
          <p className={styles.tagline}>{plan.tagline}</p>
          {billingPeriod && <p className={styles.period}>{billingPeriod} billing</p>}

          {showUsageBar && (
            <div className={styles.usageWrap}>
              <div className={styles.usageLabel}>
                <span>Replies this month</span>
                <span>
                  {usage.count} of {cap.toLocaleString("en-AU")}
                </span>
              </div>
              <div className={styles.usageTrack}>
                <div className={styles.usageFill} style={{ width: `${Math.min(100, (usage.count / cap) * 100)}%` }} />
              </div>
              {usage.cappedByRetention && (
                <p className={styles.usageNote}>This count only covers your most recent activity history.</p>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={openPortal} disabled={busy !== null || !hasStripeCustomer}>
              {busy === "portal" ? "Opening" : "Manage billing"}
            </button>
            {!cancelled ? (
              !cancelConfirm ? (
                <button type="button" className={styles.dangerBtn} onClick={() => setCancelConfirm(true)} disabled={busy !== null}>
                  Cancel plan
                </button>
              ) : (
                <button type="button" className={styles.dangerBtn} onClick={confirmCancel} disabled={busy !== null}>
                  {busy === "cancel" ? "Cancelling" : "Confirm cancel"}
                </button>
              )
            ) : null}
          </div>
          {cancelConfirm && !cancelled && (
            <p className={styles.confirmText}>
              Miia keeps answering until the end of your current billing period, then your plan ends. Click confirm to go
              ahead.
            </p>
          )}
          {cancelled && <p className={styles.confirmText}>Your plan is set to end at the close of this billing period.</p>}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </>
  );
}
