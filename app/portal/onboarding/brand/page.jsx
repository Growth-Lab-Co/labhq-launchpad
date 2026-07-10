"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Input, Button } from "@/components/ui";
import { useOnboarding } from "@/components/portal/OnboardingContext";
import s from "../onboarding.module.css";

const DEFAULT_ACCENT = "#7C4DFF";
const WELCOME_MAX = 280;

export default function BrandPage() {
  const router = useRouter();
  const { account, refetchAccount, finishingRef } = useOnboarding();
  const [logoUrl, setLogoUrl] = useState(null);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [welcome, setWelcome] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const tenant = account?.slug;

  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/branding?tenant=${encodeURIComponent(tenant)}`)
      .then((r) => r.json())
      .then((data) => {
        setLogoUrl(data.logoUrl || null);
        setAccent(data.accent || DEFAULT_ACCENT);
        setWelcome(data.welcomeMessage || "");
      })
      .catch(() => {});
  }, [tenant]);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("tenant", tenant);
      form.append("type", "logo");
      form.append("file", file);
      const res = await fetch("/api/branding/asset", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't upload the logo.");
      setLogoUrl(data.logoUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant, accent, welcomeMessage: welcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save. Try again.");

      const doneRes = await fetch("/api/portal/onboarding/brand", { method: "POST" });
      const doneData = await doneRes.json();
      if (!doneRes.ok) throw new Error(doneData.error || "Couldn't finish onboarding. Try again.");

      // finishingRef tells the shared gate to sit out its own "already
      // fully done -> dashboard" redirect for this transition - see
      // OnboardingContext.jsx for why that's needed rather than just
      // ordering these two calls.
      finishingRef.current = true;
      router.replace("/portal/onboarding/complete");
      await refetchAccount();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={s.card}>
      <h1 className={s.title}>Brand your door</h1>
      <p className={s.subtitle}>How {account?.agencyName || "your agency"}'s intake page looks to clients.</p>

      <div className={s.form}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Logo
          </label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Accent colour
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 36, height: 36, border: "none", background: "none", padding: 0 }} />
            <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{accent}</span>
          </div>
        </div>

        <Input
          label="Welcome line"
          help={`Shown at the top of your intake chat. Max ${WELCOME_MAX} characters.`}
          value={welcome}
          onChange={(e) => e.target.value.length <= WELCOME_MAX && setWelcome(e.target.value)}
          placeholder="the team at your agency is setting up your automated onboarding system"
        />

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Live preview
          </label>
          <div className={s.preview}>
            <div className={s.previewHeader}>
              <div className={s.previewBrand}>
                {logoUrl ? <img src={logoUrl} alt="Logo" /> : account?.agencyName || "Your agency"}
              </div>
              <div className={s.previewPowered}>
                powered by <b style={{ color: accent }}>Launchpad</b>
              </div>
            </div>
            <div className={s.previewBody}>
              <div className={s.previewBubble}>
                {welcome
                  ? `Hi, ${welcome}. Let's get your system set up.`
                  : "Hi, the team is setting up your automated onboarding system. Let's get started."}
              </div>
            </div>
          </div>
        </div>

        {error && <div className={s.errorBanner}>{error}</div>}
        <div className={s.actions}>
          <Button onClick={handleFinish} disabled={saving}>
            {saving ? "Saving…" : "Finish"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
