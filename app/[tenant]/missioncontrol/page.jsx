"use client";
import { useCallback, useEffect, useState } from "react";
import { getTenant } from "@/lib/tenants";
import { INTERVIEW_FIELDS, CUSTOM_VALUE_KEYS } from "@/lib/questions";

const STATUS_STEPS = [
  { key: "deployed", label: "Deployed" },
  { key: "calendar_connected", label: "Calendar connected" },
  { key: "phone_live", label: "Phone live" },
  { key: "qa_passed", label: "QA passed" },
  { key: "live", label: "Live" },
];

// Mirrors the go-live checklist shown on the deploy success screen
// (components/Chat.jsx), so an operator can eyeball what "qa_passed" means.
const QA_CHECKLIST = [
  "Assign the client as a calendar staff member.",
  "Connect their Google or Outlook calendar.",
  "Tune calendar availability — days ahead, buffers, slot length.",
  "Attach or forward their phone number.",
  "Swap the AI receptionist's transfer number to the client's escalation contact.",
  "Connect Facebook Lead Ads, if they use it.",
  "Run the four-question test call: are you a robot? a known FAQ? an unknown question? ask for a human?",
];

const FAVICON_ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/x-icon";
const LOGO_ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp,image/gif";
const TRANSIENT_STATUSES = ["uploading", "saved"];

function sessionKey(tenant) {
  return `labhq:mc:${tenant}`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function MissionControlPage({ params }) {
  const slug = params.tenant;
  const tenant = getTenant(slug);

  const [configured, setConfigured] = useState(null); // null = still checking
  const [mcKey, setMcKey] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [authError, setAuthError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [deployments, setDeployments] = useState(null);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [setupOpenIds, setSetupOpenIds] = useState(() => new Set());
  const [setupTab, setSetupTab] = useState({});
  const [copyStatus, setCopyStatus] = useState({});
  const [retrySyncStatus, setRetrySyncStatus] = useState({}); // id -> "running" | "error" | null
  const [assetInputs, setAssetInputs] = useState({ favicon: "", logo: "" });
  const [assetStatus, setAssetStatus] = useState({ favicon: null, logo: null });
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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

  const fetchDeployments = useCallback(
    async (key) => {
      setError(null);
      try {
        const res = await fetch(`/api/deployments?tenant=${encodeURIComponent(slug)}`, {
          headers: { "x-mc-key": key },
        });
        if (res.status === 401) {
          window.sessionStorage.removeItem(sessionKey(slug));
          setMcKey(null);
          setAuthError("Incorrect password.");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load deployments");
        setDeployments(data.deployments || []);
      } catch (e) {
        setError(e.message);
      }
    },
    [slug]
  );

  useEffect(() => {
    if (mcKey) fetchDeployments(mcKey);
  }, [mcKey, fetchDeployments]);

  useEffect(() => {
    if (!mcKey) return;
    fetch(`/api/branding?tenant=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setAssetInputs({ favicon: d.faviconUrl || "", logo: d.logoUrl || "" }))
      .catch(() => {});
  }, [mcKey, slug]);

  async function submitCreatePassword(e) {
    e.preventDefault();
    if (checking) return;
    const pw = passwordInput.trim();
    if (pw.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    if (pw !== confirmInput.trim()) {
      setAuthError("Passwords don't match.");
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
      if (!res.ok) throw new Error(data.error || "Failed to set password");
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
        setAuthError("Incorrect password.");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load deployments");
      window.sessionStorage.setItem(sessionKey(slug), key);
      setMcKey(key);
      setDeployments(data.deployments || []);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setChecking(false);
    }
  }

  async function setStatus(id, status) {
    if (!mcKey) return;
    const previous = deployments;
    setDeployments((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    try {
      const res = await fetch("/api/deployments", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-mc-key": mcKey },
        body: JSON.stringify({ id, status, tenant: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setDeployments((prev) => prev.map((d) => (d.id === id ? data.deployment : d)));
    } catch (e) {
      setError(e.message);
      setDeployments(previous);
    }
  }

  async function retrySync(id) {
    if (!mcKey) return;
    setRetrySyncStatus((prev) => ({ ...prev, [id]: "running" }));
    try {
      const res = await fetch("/api/deploy/retry-sync", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mc-key": mcKey },
        body: JSON.stringify({ id, tenant: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed");
      setDeployments((prev) => prev.map((d) => (d.id === id ? data.deployment : d)));
      setRetrySyncStatus((prev) => ({ ...prev, [id]: null }));
    } catch (e) {
      setRetrySyncStatus((prev) => ({ ...prev, [id]: "error" }));
    }
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSetupExpanded(id) {
    setSetupOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Tries the modern async clipboard API first, falls back to the legacy
  // execCommand approach (needed on non-secure origins / older browsers) so
  // operators pasting into GHL during QA get an honest success/failure signal
  // instead of a silent no-op.
  async function copyToClipboard(text) {
    if (!text) return false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fall through to legacy fallback below
      }
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function copyRow(key, text) {
    const ok = await copyToClipboard(text);
    setCopyStatus((s) => ({ ...s, [key]: ok ? "copied" : "error" }));
    setTimeout(() => setCopyStatus((s) => (s[key] ? { ...s, [key]: null } : s)), 2000);
  }

  function copyLabel(key, defaultLabel) {
    return copyStatus[key] === "copied" ? "Copied ✓" : copyStatus[key] === "error" ? "Failed" : defaultLabel;
  }

  function clearAssetStatusSoon(type) {
    setTimeout(() => setAssetStatus((s) => (s[type] === "saved" ? { ...s, [type]: null } : s)), 2000);
  }

  async function uploadAsset(type, file) {
    if (!mcKey || !file) return;
    setAssetStatus((s) => ({ ...s, [type]: "uploading" }));
    try {
      const form = new FormData();
      form.append("tenant", slug);
      form.append("type", type);
      form.append("file", file);
      const res = await fetch("/api/branding/asset", {
        method: "POST",
        headers: { "x-mc-key": mcKey },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to upload ${type}`);
      setAssetInputs((s) => ({ ...s, [type]: data[`${type}Url`] || "" }));
      setAssetStatus((s) => ({ ...s, [type]: "saved" }));
      clearAssetStatusSoon(type);
    } catch (e) {
      setAssetStatus((s) => ({ ...s, [type]: e.message }));
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(`https://${slug}.labhq.co`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (!tenant) {
    return (
      <main className="mc-shell">
        <p className="mc-error">Unknown tenant.</p>
      </main>
    );
  }

  const logoSrc = assetInputs.logo || tenant.logoUrl;

  return (
    <main className="mc-shell">
      <header className="mc-topbar">
        <div className="mc-brand">
          {logoSrc ? <img src={logoSrc} alt={tenant.name} /> : tenant.logoText}
        </div>
        <div className="mc-topbar-right">
          <div className="mc-powered">
            Mission Control — <b>{tenant.name}</b>
          </div>
          {mcKey && (
            <a className="mc-btn-outline" href={`/${slug}`} target="_blank" rel="noopener noreferrer">
              + New client
            </a>
          )}
        </div>
      </header>

      {!mcKey && configured === null && (
        <section className="mc-gate">
          <p className="mc-sub">Loading…</p>
        </section>
      )}

      {!mcKey && configured === false && (
        <section className="mc-gate">
          <h2>Create a password</h2>
          <p className="mc-sub">
            No password has been set for {tenant.name}&apos;s dashboard yet. Choose one now — you&apos;ll use it
            every time you come back.
          </p>
          <form onSubmit={submitCreatePassword} className="mc-gate-form stacked">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="New password (min. 8 characters)"
              aria-label="New Mission Control password"
              autoFocus
            />
            <input
              type="password"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Confirm password"
              aria-label="Confirm Mission Control password"
            />
            <button
              className="mc-btn"
              type="submit"
              disabled={checking || !passwordInput.trim() || !confirmInput.trim()}
            >
              {checking ? "Saving…" : "Set password"}
            </button>
          </form>
          {authError && <div className="mc-error">{authError}</div>}
        </section>
      )}

      {!mcKey && configured === true && (
        <section className="mc-gate">
          <h2>Enter password</h2>
          <p className="mc-sub">This dashboard is restricted to the operations team.</p>
          <form onSubmit={submitPassword} className="mc-gate-form">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              aria-label="Mission Control password"
              autoFocus
            />
            <button className="mc-btn" type="submit" disabled={checking || !passwordInput.trim()}>
              {checking ? "Checking…" : "Enter"}
            </button>
          </form>
          {authError && <div className="mc-error">{authError}</div>}
        </section>
      )}

      {mcKey && (
        <>
          <div className="mc-link-row">
            <span className="mc-sub">Client onboarding link:</span>
            <code className="mc-link-code">{`${slug}.labhq.co`}</code>
            <button type="button" className="mc-btn-outline" onClick={copyLink}>
              {linkCopied ? "Copied ✓" : "Copy link"}
            </button>
          </div>

          <details className="mc-branding" open={brandingOpen} onToggle={(e) => setBrandingOpen(e.target.open)}>
            <summary>Branding</summary>

            <div className="mc-brand-row">
              <span className="mc-brand-row-label">Favicon</span>
              <div className="mc-brand-row-body">
                {assetInputs.favicon && <img className="mc-asset-preview" src={assetInputs.favicon} alt="" />}
                <label className="mc-btn-outline mc-upload-btn">
                  {assetStatus.favicon === "uploading" ? "Uploading…" : assetInputs.favicon ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept={FAVICON_ACCEPT}
                    onChange={(e) => e.target.files[0] && uploadAsset("favicon", e.target.files[0])}
                    hidden
                  />
                </label>
              </div>
              {assetStatus.favicon === "saved" && <div className="mc-saved">Saved ✓</div>}
              {assetStatus.favicon && !TRANSIENT_STATUSES.includes(assetStatus.favicon) && (
                <div className="mc-error">{assetStatus.favicon}</div>
              )}
            </div>

            <div className="mc-brand-row">
              <span className="mc-brand-row-label">Logo</span>
              <div className="mc-brand-row-body">
                {assetInputs.logo && <img className="mc-asset-preview mc-asset-preview-logo" src={assetInputs.logo} alt="" />}
                <label className="mc-btn-outline mc-upload-btn">
                  {assetStatus.logo === "uploading" ? "Uploading…" : assetInputs.logo ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept={LOGO_ACCEPT}
                    onChange={(e) => e.target.files[0] && uploadAsset("logo", e.target.files[0])}
                    hidden
                  />
                </label>
              </div>
              {assetStatus.logo === "saved" && <div className="mc-saved">Saved ✓</div>}
              {assetStatus.logo && !TRANSIENT_STATUSES.includes(assetStatus.logo) && (
                <div className="mc-error">{assetStatus.logo}</div>
              )}
            </div>

            <p className="mc-sub">
              Uploads apply immediately across {tenant.name}&apos;s intake page and dashboard - no redeploy needed.
            </p>
          </details>

          <section className="mc-list">
            {error && <div className="mc-error">{error}</div>}

            {deployments === null && <p className="mc-sub">Loading…</p>}

            {deployments && deployments.length === 0 && (
              <div className="mc-empty">No deployments yet — they&apos;ll appear here the moment one lands.</div>
            )}

            {deployments && deployments.length > 0 && (
              <div className="mc-rows">
                {deployments.map((d) => {
                  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === d.status);
                  const expanded = expandedIds.has(d.id);
                  return (
                    <div className="mc-row" key={d.id}>
                      <div className="mc-row-head">
                        <div className="mc-row-title">
                          <span className="mc-biz-name">{d.businessName || "Unnamed business"}</span>
                          {d.demo && <span className="mc-badge-demo">Demo</span>}
                        </div>
                        <div className="mc-row-date">{formatDate(d.createdAt)}</div>
                      </div>

                      <div className="mc-stepper" role="group" aria-label="Deployment status">
                        {STATUS_STEPS.map((step, i) => (
                          <button
                            key={step.key}
                            type="button"
                            className={`mc-step ${i < currentIndex ? "done" : i === currentIndex ? "active" : ""}`}
                            onClick={() => setStatus(d.id, step.key)}
                          >
                            <span className="mc-step-dot" />
                            <span className="mc-step-label">{step.label}</span>
                          </button>
                        ))}
                      </div>

                      {d.locationAuthNeeded && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="mc-btn-outline"
                            disabled={retrySyncStatus[d.id] === "running"}
                            onClick={() => retrySync(d.id)}
                          >
                            {retrySyncStatus[d.id] === "running" ? "Retrying…" : "Retry data sync"}
                          </button>
                          {retrySyncStatus[d.id] === "error" && (
                            <span className="mc-sub"> Still not authorised — connect the location app for this sub-account first.</span>
                          )}
                        </div>
                      )}

                      <details
                        className="mc-setup"
                        open={setupOpenIds.has(d.id)}
                        onToggle={() => toggleSetupExpanded(d.id)}
                      >
                        <summary>Setup details</summary>
                        <div className="mc-setup-tabs">
                          <button
                            type="button"
                            className={`mc-tab ${(setupTab[d.id] || "answers") === "answers" ? "active" : ""}`}
                            onClick={() => setSetupTab((s) => ({ ...s, [d.id]: "answers" }))}
                          >
                            Interview answers
                          </button>
                          <button
                            type="button"
                            className={`mc-tab ${setupTab[d.id] === "values" ? "active" : ""}`}
                            onClick={() => setSetupTab((s) => ({ ...s, [d.id]: "values" }))}
                          >
                            Custom values
                          </button>
                        </div>

                        {(setupTab[d.id] || "answers") === "answers" ? (
                          !d.answers ? (
                            <p className="mc-sub">Not recorded for this deployment.</p>
                          ) : (
                            <div className="mc-kv-list">
                              {INTERVIEW_FIELDS.map((f) => (
                                <div className="mc-kv-row" key={f.field}>
                                  <div className="mc-kv-label">{f.ask}</div>
                                  <div className="mc-kv-value">{d.answers[f.field] || "—"}</div>
                                </div>
                              ))}
                            </div>
                          )
                        ) : !d.customValues ? (
                          <p className="mc-sub">Not recorded for this deployment.</p>
                        ) : (
                          <>
                            <div className="mc-copy-all-row">
                              <button
                                type="button"
                                className="mc-btn-outline"
                                onClick={() =>
                                  copyRow(
                                    `${d.id}:all`,
                                    CUSTOM_VALUE_KEYS.map((key) => `${key}: ${d.customValues[key] ?? ""}`).join("\n")
                                  )
                                }
                              >
                                {copyLabel(`${d.id}:all`, "Copy all")}
                              </button>
                            </div>
                            <div className="mc-kv-list">
                              {CUSTOM_VALUE_KEYS.map((key) => (
                                <div className="mc-kv-row" key={key}>
                                  <div className="mc-kv-label">{key.replaceAll("_", " ")}</div>
                                  <div className="mc-kv-value">{d.customValues[key] ?? ""}</div>
                                  <button
                                    type="button"
                                    className="mc-copy-btn"
                                    onClick={() => copyRow(`${d.id}:${key}`, String(d.customValues[key] ?? ""))}
                                  >
                                    {copyLabel(`${d.id}:${key}`, "Copy")}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </details>

                      <details className="mc-checklist" open={expanded} onToggle={() => toggleExpanded(d.id)}>
                        <summary>QA checklist</summary>
                        <ol>
                          {QA_CHECKLIST.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ol>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <style jsx>{`
        .mc-shell {
          max-width: 880px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          min-height: 100vh;
        }
        .mc-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
          margin-bottom: 28px;
        }
        .mc-topbar-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .mc-brand { font-weight: 700; font-size: 18px; letter-spacing: 0.02em; }
        .mc-brand img { max-height: 34px; display: block; }
        .mc-powered { font-size: 13px; color: var(--muted); }
        .mc-powered b { color: var(--accent); font-weight: 600; }

        .mc-btn-outline {
          background: transparent;
          color: var(--accent);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 8px 16px;
          font-family: inherit;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
          display: inline-block;
        }
        .mc-btn-outline:hover { border-color: var(--accent-soft); }
        .mc-upload-btn { display: inline-flex; align-items: center; }

        .mc-sub { color: var(--muted); font-size: 14px; }

        .mc-link-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .mc-link-code {
          font-family: monospace;
          font-size: 13px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 4px 10px;
        }

        .mc-gate {
          max-width: 360px;
          margin: 10vh auto 0;
          text-align: center;
        }
        .mc-gate h2 { font-size: 22px; margin-bottom: 6px; }
        .mc-gate-form {
          display: flex;
          gap: 10px;
          margin-top: 18px;
        }
        .mc-gate-form.stacked {
          flex-direction: column;
          align-items: stretch;
        }
        .mc-gate-form input {
          flex: 1;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px 14px;
          color: var(--text);
          font-family: inherit;
          font-size: 15px;
        }
        .mc-gate-form input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

        .mc-btn {
          background: var(--accent);
          color: #14102e;
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-family: inherit;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          white-space: nowrap;
        }
        .mc-btn:disabled { opacity: 0.4; cursor: default; }

        .mc-error {
          color: #ac2f34;
          font-size: 14px;
          margin-top: 14px;
        }
        .mc-saved {
          color: #2fa876;
          font-size: 14px;
          margin-top: 10px;
        }

        .mc-empty {
          color: var(--muted);
          font-size: 15px;
          text-align: center;
          padding: 64px 20px;
          border: 1px dashed var(--line);
          border-radius: 14px;
        }

        .mc-branding {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 4px 18px;
          margin-bottom: 20px;
        }
        .mc-branding summary {
          cursor: pointer;
          padding: 14px 0;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--accent);
          list-style: none;
        }
        .mc-branding summary::-webkit-details-marker { display: none; }
        .mc-brand-row {
          padding: 10px 0;
          border-top: 1px solid var(--line);
        }
        .mc-brand-row-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 8px;
        }
        .mc-brand-row-body { display: flex; align-items: center; gap: 10px; }
        .mc-asset-preview {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid var(--line);
          object-fit: contain;
          margin-right: 10px;
          flex-shrink: 0;
          background: var(--bg);
        }
        .mc-asset-preview-logo { border-radius: 4px; }
        .mc-branding > .mc-sub { padding: 10px 0 14px; }

        .mc-rows { display: flex; flex-direction: column; gap: 16px; }
        .mc-row {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px 18px;
        }
        .mc-row-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .mc-row-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .mc-biz-name { font-size: 16px; font-weight: 600; }
        .mc-row-date { font-size: 12px; color: var(--muted); }
        .mc-badge-demo {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 2px 8px;
        }

        .mc-stepper {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 4px;
          margin-bottom: 4px;
        }
        .mc-step {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 6px 12px 6px 8px;
          color: var(--muted);
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: color 150ms ease, border-color 150ms ease;
        }
        .mc-step:hover { color: var(--text); border-color: var(--accent-soft); }
        .mc-step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--line);
          flex-shrink: 0;
        }
        .mc-step.active { color: var(--text); border-color: var(--accent); }
        .mc-step.active .mc-step-dot { background: var(--accent); }
        .mc-step.done { color: var(--text); }
        .mc-step.done .mc-step-dot { background: #2fa876; }

        .mc-checklist {
          margin-top: 12px;
          border-top: 1px solid var(--line);
          padding-top: 10px;
        }
        .mc-checklist summary {
          cursor: pointer;
          font-size: 13px;
          color: var(--accent);
        }
        .mc-checklist ol {
          margin: 10px 0 0 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.5;
        }

        .mc-setup {
          margin-top: 12px;
          border-top: 1px solid var(--line);
          padding-top: 10px;
        }
        .mc-setup summary {
          cursor: pointer;
          font-size: 13px;
          color: var(--accent);
        }
        .mc-setup-tabs {
          display: flex;
          gap: 8px;
          margin: 12px 0;
        }
        .mc-tab {
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 6px 14px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          cursor: pointer;
        }
        .mc-tab:hover { color: var(--text); border-color: var(--accent-soft); }
        .mc-tab.active { color: var(--text); border-color: var(--accent); background: var(--surface); }

        .mc-copy-all-row { margin-bottom: 10px; }

        .mc-kv-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mc-kv-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .mc-kv-label {
          flex: 0 0 180px;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent);
        }
        .mc-kv-value {
          flex: 1;
          font-size: 13px;
          color: var(--text);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .mc-copy-btn {
          flex-shrink: 0;
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 4px 10px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          color: var(--accent);
          cursor: pointer;
          white-space: nowrap;
        }
        .mc-copy-btn:hover { border-color: var(--accent-soft); }

        @media (max-width: 480px) {
          .mc-step { padding: 6px 10px 6px 7px; font-size: 11px; }
          .mc-row-head { flex-direction: column; align-items: flex-start; gap: 4px; }
          .mc-kv-row { flex-direction: column; align-items: stretch; }
          .mc-kv-label { flex-basis: auto; }
        }
      `}</style>
    </main>
  );
}
