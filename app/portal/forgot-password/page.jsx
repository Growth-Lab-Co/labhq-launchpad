"use client";
import { useState } from "react";
import Link from "next/link";
import { Card, Input, Button } from "@/components/ui";
import s from "../portal.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={s.shell}>
      <Link href="/" className={`${s.wordmark} font-display`}>
        Lab HQ
      </Link>
      <Card className={s.card}>
        <h1 className={s.title}>Reset your password</h1>
        <p className={s.subtitle}>Enter the email on your portal account.</p>
        {message ? (
          <div className={s.infoBanner}>{message}</div>
        ) : (
          <form onSubmit={submit} className={s.form}>
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <div className={s.errorBanner}>{error}</div>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset instructions"}
            </Button>
          </form>
        )}
        <div className={s.centerLink}>
          <Link href="/portal">Back to log in</Link>
        </div>
      </Card>
    </main>
  );
}
