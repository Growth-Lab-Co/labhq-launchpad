"use client";
import { useCallback, useEffect, useState } from "react";
import { ToastProvider, useToast } from "@/components/ui";
import { MissionControlProvider } from "@/components/missioncontrol/MissionControlContext";
import { SearchProvider } from "@/components/missioncontrol/SearchContext";
import { AppShell } from "@/components/missioncontrol/AppShell";
import s from "./gate.module.css";

function sessionKey(tenant) {
  return `labhq:mc:${tenant}`;
}

export default function MissionControlLayout({ children, params }) {
  return (
    <ToastProvider>
      <MissionControlGate slug={params.tenant}>{children}</MissionControlGate>
    </ToastProvider>
  );
}

function MissionControlGate({ slug, children }) {
  const toast = useToast();

  // undefined = still loading, null = confirmed unknown tenant
  const [tenant, setTenant] = useState(undefined);
  const [configured, setConfigured] = useState(null);
  const [mcKey, setMcKey] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [authError, setAuthError] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch(`/api/tenant-public?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTenant)
      .catch(() => setTenant(null));
  }, [slug]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(sessionKey(slug));
    if (stored) setMcKey(stored);
  }, [slug]);

  useEffect(() => {
    fetch(`/api/mc-auth?tenant=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, [slug]);

  const verifyStoredKey = useCallback(
    async (key) => {
      try {
        const res = await fetch(`/api/deployments?tenant=${encodeURIComponent(slug)}`, {
          headers: { "x-mc-key": key },
        });
        if (res.status === 401) {
          window.sessionStorage.removeItem(sessionKey(slug));
          setMcKey(null);
        }
      } catch {
        // A network hiccup shouldn't log the operator out - the next real
        // request will surface the same 401 if the key is actually bad.
      }
    },
    [slug]
  );

  useEffect(() => {
    if (mcKey) verifyStoredKey(mcKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcKey]);

  async function submitCreatePassword(e) {
    e.preventDefault();
    if (checking) return;
    const pw = passwordInput.trim();
    if (pw.length < 8) {
      setAuthError("Use at least 8 characters.");
      return;
    }
    if (pw !== confirmInput.trim()) {
      setAuthError("Those passwords don't match.");
      return;
    }
    setChecking(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/mc-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: slug, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't set the password. Try again.");
      window.sessionStorage.setItem(sessionKey(slug), pw);
      setMcKey(pw);
      setConfigured(true);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setChecking(false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    if (!passwordInput.trim() || checking) return;
    setChecking(true);
    setAuthError(null);
    const key = passwordInput.trim();
    try {
      const res = await fetch(`/api/deployments?tenant=${encodeURIComponent(slug)}`, {
        headers: { "x-mc-key": key },
      });
      if (res.status === 401) {
        setAuthError("That password isn't right. Try again.");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Couldn't sign in. Try again.");
      }
      window.sessionStorage.setItem(sessionKey(slug), key);
      setMcKey(key);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setChecking(false);
    }
  }

  if (tenant === null) {
    return (
      <main className={s.shell}>
        <p className={s.errorText}>We don't recognise this workspace. Check the URL and try again.</p>
      </main>
    );
  }

  if (tenant === undefined || (!mcKey && configured === null)) {
    return (
      <main className={s.shell}>
        <p className={s.muted}>Loading…</p>
      </main>
    );
  }

  if (!mcKey && configured === false) {
    return (
      <main className={s.shell}>
        <section className={s.gate}>
          <h2 className={s.gateTitle}>Set a password</h2>
          <p className={s.muted}>
            {tenant.name} doesn't have a dashboard password yet. Choose one now — you'll use it every time you come
            back.
          </p>
          <form onSubmit={submitCreatePassword} className={s.gateForm}>
            <input
              type="password"
              className={s.input}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="New password (min. 8 characters)"
              aria-label="New Mission Control password"
              autoFocus
            />
            <input
              type="password"
              className={s.input}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Confirm password"
              aria-label="Confirm Mission Control password"
            />
            <button type="submit" className={s.submitButton} disabled={checking || !passwordInput.trim() || !confirmInput.trim()}>
              {checking ? "Saving…" : "Set password"}
            </button>
          </form>
          {authError && <div className={s.errorText}>{authError}</div>}
        </section>
      </main>
    );
  }

  if (!mcKey && configured === true) {
    return (
      <main className={s.shell}>
        <section className={s.gate}>
          <h2 className={s.gateTitle}>Enter password</h2>
          <p className={s.muted}>This dashboard is restricted to the operations team.</p>
          <form onSubmit={submitPassword} className={s.gateForm}>
            <input
              type="password"
              className={s.input}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              aria-label="Mission Control password"
              autoFocus
            />
            <button type="submit" className={s.submitButton} disabled={checking || !passwordInput.trim()}>
              {checking ? "Checking…" : "Enter"}
            </button>
          </form>
          {authError && <div className={s.errorText}>{authError}</div>}
        </section>
      </main>
    );
  }

  return (
    <MissionControlProvider slug={slug} tenant={tenant} mcKey={mcKey} toast={toast}>
      <SearchProvider>
        <AppShell base={`/${slug}/missioncontrol`} tenant={tenant}>
          {children}
        </AppShell>
      </SearchProvider>
    </MissionControlProvider>
  );
}
