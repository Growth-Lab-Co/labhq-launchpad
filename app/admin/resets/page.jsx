"use client";
import { useState } from "react";
import { Input, Button, Card, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "../admin.module.css";

export default function ResetsPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const data = await adminFetch("/api/admin/resets", { method: "POST", body: { email } });
      setResult(data);
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/portal/reset-password?token=${result.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied - the field text is still visible to copy manually.
    }
  }

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Password resets</h1>
        <p className={s.pageSubtitle}>
          Generate a reset link for an agency when email delivery isn't set up (RESEND_API_KEY unset).
        </p>
      </div>

      <Card style={{ maxWidth: 480 }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="Account email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Generating…" : "Generate reset link"}
          </Button>
        </form>

        {result && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
              For {result.agencyName} - expires in 1 hour, single use.
            </p>
            <div className={s.copyRow}>
              <span className={s.copyField}>/portal/reset-password?token={result.token}</span>
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
