"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Button } from "@/components/ui";
import s from "../../portal.module.css";

export default function ClaimPage({ params }) {
  const router = useRouter();
  const [status, setStatus] = useState(undefined); // undefined = loading, then { valid, ... }
  const [agencyName, setAgencyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/portal/claim/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.valid) setAgencyName(data.tenantName);
      })
      .catch(() => setStatus({ valid: false }));
  }, [params.token]);

  async function submit(e) {
    e.preventDefault();
    if (!acceptTerms) {
      setError("You must agree to the licence terms to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/claim/${params.token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agencyName, contactEmail, password, acceptTerms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't claim this workspace. Try again.");
      router.replace("/portal/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === undefined) {
    return (
      <main className={s.shell}>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
      </main>
    );
  }

  if (!status.valid) {
    return (
      <main className={s.shell}>
        <Link href="/" className={`${s.wordmark} font-display`}>Lab HQ</Link>
        <Card className={s.card}>
          <h1 className={s.title}>This claim link isn't valid</h1>
          <p className={s.subtitle}>It may have already been used or expired. Ask your Lab HQ operator for a new one.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className={s.shell}>
      <Link href="/" className={`${s.wordmark} font-display`}>Lab HQ</Link>
      <Card className={s.card}>
        <h1 className={s.title}>Claim {status.tenantName}'s portal</h1>
        <p className={s.subtitle}>
          Set up your portal login for the workspace you already have at {status.tenantSlug}.labhq.co.
        </p>
        <form onSubmit={submit} className={s.form}>
          <Input label="Agency name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} required />
          <Input
            label="Contact email"
            type="email"
            autoComplete="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            help="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className={s.checkboxRow}>
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
            <span>
              I agree to the <Link href="/terms" target="_blank">LabHQ licence terms</Link>
            </span>
          </label>
          {error && <div className={s.errorBanner}>{error}</div>}
          <Button type="submit" disabled={submitting || !acceptTerms}>
            {submitting ? "Claiming…" : "Claim this workspace"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
