"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Input, Button } from "@/components/ui";
import { useOnboarding } from "@/components/portal/OnboardingContext";
import s from "../onboarding.module.css";

export default function SnapshotPage() {
  const router = useRouter();
  const { refetchAccount } = useOnboarding();
  const [shareUrl, setShareUrl] = useState(null);
  const [snapshotId, setSnapshotId] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/portal/onboarding/snapshot")
      .then((r) => r.json())
      .then((data) => {
        setShareUrl(data.shareUrl);
        if (data.snapshotId) setSnapshotId(data.snapshotId);
      })
      .catch(() => {});
  }, []);

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied - the field itself is still selectable/copyable manually.
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/onboarding/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't verify that snapshot ID. Try again.");
      await refetchAccount();
      router.replace("/portal/onboarding/brand");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className={s.card}>
      <h1 className={s.title}>Import the snapshot</h1>
      <p className={s.subtitle}>
        Import the Lab HQ snapshot into your agency account, then paste the snapshot ID it creates.
      </p>

      {shareUrl ? (
        <div style={{ marginBottom: 20 }}>
          <p className={s.subtitle} style={{ marginBottom: 8 }}>
            1. Open this share link in GoHighLevel and import it into your agency.
          </p>
          <div className={s.copyRow}>
            <span className={s.copyField}>{shareUrl}</span>
            <Button variant="secondary" size="sm" onClick={copyShareUrl}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <div className={s.infoBanner} style={{ marginBottom: 20 }}>
          No snapshot share link is configured yet - ask your Lab HQ operator for one, or for the snapshot ID directly.
        </div>
      )}

      <form onSubmit={submit} className={s.form}>
        <Input
          label="2. Your snapshot ID"
          help="Found on the snapshot's page in GoHighLevel after importing it."
          value={snapshotId}
          onChange={(e) => setSnapshotId(e.target.value.trim())}
          required
        />
        {error && <div className={s.errorBanner}>{error}</div>}
        <div className={s.actions}>
          <Button type="submit" disabled={submitting || !snapshotId.trim()}>
            {submitting ? "Verifying…" : "Continue"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
