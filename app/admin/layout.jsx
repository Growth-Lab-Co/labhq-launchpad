"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, Input, Button, ToastProvider } from "@/components/ui";
import { SESSION_KEY } from "@/components/admin/adminKey";
import s from "./admin.module.css";

const NAV = [
  { label: "Tenants", path: "/admin" },
  { label: "Miia signups", path: "/admin/miia-signups" },
  { label: "Invite codes", path: "/admin/invites" },
  { label: "Claim links", path: "/admin/claims" },
  { label: "Password resets", path: "/admin/resets" },
  { label: "Backups", path: "/admin/backups" },
  { label: "Activity", path: "/admin/activity" },
];

export default function AdminLayout({ children }) {
  return (
    <ToastProvider>
      <AdminGate>{children}</AdminGate>
    </ToastProvider>
  );
}

function AdminGate({ children }) {
  const pathname = usePathname();
  const [configured, setConfigured] = useState(null);
  const [adminKey, setAdminKey] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) setAdminKey(stored);
  }, []);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!passwordInput.trim() || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.status === 401) {
        setError("That password isn't right.");
        return;
      }
      if (!res.ok) throw new Error("Couldn't sign in. Try again.");
      window.sessionStorage.setItem(SESSION_KEY, passwordInput);
      setAdminKey(passwordInput);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  if (configured === false) {
    return (
      <main className={s.gateShell}>
        <Card className={s.gateCard}>
          <h1 className={s.gateTitle}>Admin console unavailable</h1>
          <p className={s.gateSubtitle}>Set MC_PASSWORD on this site to use the operator admin console.</p>
        </Card>
      </main>
    );
  }

  if (!adminKey) {
    return (
      <main className={s.gateShell}>
        <Card className={s.gateCard}>
          <h1 className={s.gateTitle}>Operator sign in</h1>
          <p className={s.gateSubtitle}>Enter the MC_PASSWORD master password.</p>
          <form onSubmit={submit} className={s.gateForm}>
            <Input
              type="password"
              label="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            {error && <div className={s.errorBanner}>{error}</div>}
            <Button type="submit" disabled={checking || !passwordInput.trim()}>
              {checking ? "Checking…" : "Enter"}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <div className={s.shell}>
      <header className={s.topbar}>
        <Link href="/admin" className={`${s.wordmark} font-display`}>
          Lab HQ admin
        </Link>
        <nav className={s.nav}>
          {NAV.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`${s.navLink} ${pathname === item.path ? s.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className={s.content}>{children}</div>
    </div>
  );
}
