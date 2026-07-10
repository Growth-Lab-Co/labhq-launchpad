"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Input, Button, Badge } from "@/components/ui";
import { useOnboarding } from "@/components/portal/OnboardingContext";
import s from "../onboarding.module.css";

export default function ActivatePage() {
  const router = useRouter();
  const { refetchAccount } = useOnboarding();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function submitCode(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/onboarding/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't activate. Try again.");
      await refetchAccount();
      router.replace("/portal/onboarding/connect");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/onboarding/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Card payment isn't available right now.");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setCheckoutLoading(false);
    }
  }

  return (
    <Card className={s.card}>
      <h1 className={s.title}>Activate your subscription</h1>
      <p className={s.subtitle}>Use an invite code, or pay by card.</p>

      <form onSubmit={submitCode} className={s.form}>
        <Input
          label="Invite code"
          placeholder="XXXXX-XXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
        {error && <div className={s.errorBanner}>{error}</div>}
        <Button type="submit" disabled={submitting || !code.trim()}>
          {submitting ? "Activating…" : "Activate with code"}
        </Button>
      </form>

      <div className={s.divider} style={{ margin: "20px 0" }}>
        or
      </div>

      <div>
        <Button variant="secondary" onClick={startCheckout} disabled={checkoutLoading} style={{ width: "100%" }}>
          {checkoutLoading ? "Starting checkout…" : "Pay by card"}
        </Button>
        <p className={s.subtitle} style={{ marginTop: 8, marginBottom: 0 }}>
          <Badge tone="neutral">Founding partner</Badge> plan, activated once your first invoice is paid.
        </p>
      </div>
    </Card>
  );
}
