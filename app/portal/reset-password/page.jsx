"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Input, Button } from "@/components/ui";
import s from "../portal.module.css";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't reset your password. Try again.");
      router.replace(data.account.onboarding?.completedAt ? "/portal/dashboard" : "/portal/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <div className={s.errorBanner}>This reset link is missing its token. Check the link and try again.</div>;
  }

  return (
    <form onSubmit={submit} className={s.form}>
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        help="At least 8 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      {error && <div className={s.errorBanner}>{error}</div>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className={s.shell}>
      <Link href="/" className={`${s.wordmark} font-display`}>
        Lab HQ
      </Link>
      <Card className={s.card}>
        <h1 className={s.title}>Set a new password</h1>
        <p className={s.subtitle}>Choose a new password for your portal account.</p>
        <Suspense fallback={<p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </main>
  );
}
