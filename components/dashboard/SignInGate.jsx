"use client";
import { useState } from "react";
import { TwoDots } from "./TwoDots";
import styles from "./SignInGate.module.css";

// Shown when a customer reaches their dashboard URL without a valid session
// (cleared cookies, new device, or the very first click of a link that
// somehow didn't authenticate). Always shows the same generic confirmation
// after submitting, whether or not the email matched - see
// app/api/miia/auth/request-link/route.js for why.
export function SignInGate({ tenantSlug, businessName }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/miia/auth/request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, email: email.trim() }),
      });
      if (!res.ok) throw new Error("Something went wrong. Try again in a moment.");
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="miia-dashboard">
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.brandRow}>
            <TwoDots size="md" />
            <span className={styles.brandName}>miia</span>
          </div>
          <h1 className={styles.heading}>Sign in to {businessName || "your dashboard"}</h1>
          {sent ? (
            <p className={styles.sentText}>
              If that email is on this account, a sign-in link is on its way. It works once, for the next 30
              minutes.
            </p>
          ) : (
            <>
              <p className={styles.sub}>Enter the email you signed up with and we&apos;ll send you a link.</p>
              <form onSubmit={submit} className={styles.form}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                  className={styles.input}
                  autoFocus
                  required
                />
                <button type="submit" className={styles.button} disabled={busy || !email.trim()}>
                  {busy ? "Sending" : "Send sign-in link"}
                </button>
              </form>
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
