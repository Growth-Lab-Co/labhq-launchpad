"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Button, Tabs } from "@/components/ui";
import s from "./portal.module.css";

const MODES = [
  { value: "login", label: "Log in" },
  { value: "signup", label: "Sign up" },
];

function useSlugCheck(slug) {
  const [status, setStatus] = useState(null); // null | { available, reason }
  const [checking, setChecking] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!slug) {
      setStatus(null);
      return;
    }
    setChecking(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/portal/slug-check?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setStatus(data);
      } catch {
        setStatus(null);
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [slug]);

  return { status, checking };
}

export default function PortalPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [sessionChecked, setSessionChecked] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup fields
  const [agencyName, setAgencyName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { status: slugStatus, checking: slugChecking } = useSlugCheck(slug);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/portal/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.account) {
          router.replace(data.account.onboarding?.completedAt ? "/portal/dashboard" : "/portal/onboarding");
        } else {
          setSessionChecked(true);
        }
      })
      .catch(() => setSessionChecked(true));
  }, [router]);

  async function submitLogin(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't log in. Try again.");
      router.replace(data.account.onboarding?.completedAt ? "/portal/dashboard" : "/portal/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSignup(e) {
    e.preventDefault();
    if (!acceptTerms) {
      setError("You must agree to the licence terms to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agencyName,
          slug,
          contactEmail,
          password: signupPassword,
          acceptTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create your account. Try again.");
      router.replace("/portal/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!sessionChecked) {
    return (
      <main className={s.shell}>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className={s.shell}>
      <Link href="/" className={`${s.wordmark} font-display`}>
        Lab HQ
      </Link>

      <Card className={s.card}>
        <Tabs items={MODES} value={mode} onChange={(v) => { setMode(v); setError(null); }} className={s.tabs} />

        {mode === "login" ? (
          <>
            <h1 className={s.title}>Welcome back</h1>
            <p className={s.subtitle}>Sign in to your agency's Lab HQ portal.</p>
            <form onSubmit={submitLogin} className={s.form}>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
              {error && <div className={s.errorBanner}>{error}</div>}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Signing in…" : "Log in"}
              </Button>
            </form>
            <div className={s.centerLink}>
              <Link href="/portal/forgot-password">Forgot password?</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className={s.title}>Create your agency's portal</h1>
            <p className={s.subtitle}>Set up your own Lab HQ door in a few minutes.</p>
            <form onSubmit={submitSignup} className={s.form}>
              <Input
                label="Agency name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                required
              />
              <div>
                <div className={s.slugRow}>
                  <div className={s.slugInput}>
                    <Input
                      label="Subdomain"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="youragency"
                      required
                    />
                  </div>
                  <span className={s.slugSuffix}>.labhq.co</span>
                </div>
                {slug && !slugChecking && slugStatus && (
                  <p className={`${s.slugStatus} ${slugStatus.available ? s.ok : s.bad}`}>
                    {slugStatus.available ? "Available" : slugStatus.reason}
                  </p>
                )}
              </div>
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
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
              />
              <label className={s.checkboxRow}>
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" target="_blank">
                    LabHQ licence terms
                  </Link>
                </span>
              </label>
              {error && <div className={s.errorBanner}>{error}</div>}
              <Button type="submit" disabled={submitting || !acceptTerms || (slugStatus && !slugStatus.available)}>
                {submitting ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
