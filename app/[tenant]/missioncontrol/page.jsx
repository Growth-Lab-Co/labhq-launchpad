"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { getTenant } from "@/lib/tenants";
import { INTERVIEW_FIELDS, CUSTOM_VALUE_KEYS } from "@/lib/questions";
import { Button, Badge, Card, Table, Tabs, ProgressBar, EmptyState, ToastProvider, useToast } from "@/components/ui";
import fieldStyles from "@/components/ui/Field.module.css";
import s from "./missioncontrol.module.css";

const STATUS_STEPS = [
  { key: "deployed", label: "Deployed", tone: "neutral" },
  { key: "calendar_connected", label: "Calendar connected", tone: "neutral" },
  { key: "phone_live", label: "Phone live", tone: "warning" },
  { key: "qa_passed", label: "QA passed", tone: "accent" },
  { key: "live", label: "Live", tone: "success" },
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
  return (
    <ToastProvider>
      <MissionControl params={params} />
    </ToastProvider>
  );
}

function MissionControl({ params }) {
  const slug = params.tenant;
  const tenant = getTenant(slug);
  const toast = useToast();

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
  const [qaOpenIds, setQaOpenIds] = useState(() => new Set());
  const [setupTab, setSetupTab] = useState({});
  const [copyStatus, setCopyStatus] = useState({});
  const [retrySyncStatus, setRetrySyncStatus] = useState({}); // id -> "running" | null
  const [assetInputs, setAssetInputs] = useState({ favicon: "", logo: "" });
  const [assetStatus, setAssetStatus] = useState({ favicon: null, logo: null });
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
          setAuthError("That password isn't right. Try again.");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your clients. Refresh the page to try again.");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load your clients. Try again.");
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
      if (!res.ok) throw new Error(data.error || "Couldn't update the status.");
      setDeployments((prev) => prev.map((d) => (d.id === id ? data.deployment : d)));
    } catch (e) {
      setDeployments(previous);
      toast.push("Couldn't update the status. Try again.", "error");
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
      toast.push("Data sync retried.", "success");
    } catch (e) {
      setRetrySyncStatus((prev) => ({ ...prev, [id]: null }));
      toast.push("Still not authorised. Connect the location app for this sub-account, then retry.", "error");
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

  function toggleQaExpanded(id) {
    setQaOpenIds((prev) => {
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
    return copyStatus[key] === "copied" ? "Copied" : copyStatus[key] === "error" ? "Couldn't copy" : defaultLabel;
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
      if (!res.ok) throw new Error(data.error || `Couldn't upload the ${type}. Try a different file.`);
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
      <main className={s.shell}>
        <p className={s.errorText}>We don't recognise this workspace. Check the URL and try again.</p>
      </main>
    );
  }

  const logoSrc = assetInputs.logo || tenant.logoUrl;

  return (
    <main className={s.shell}>
      <header className={s.header}>
        <div className={s.headerLeft}>
          {logoSrc ? <img src={logoSrc} alt={tenant.name} style={{ maxHeight: 28 }} /> : <span className={s.brand}>{tenant.logoText}</span>}
          <div className={s.headerMeta}>
            <span className={s.title}>Mission control</span>
            <span className={s.subtitle}>{tenant.name}</span>
          </div>
        </div>
        {mcKey && (
          <div className={s.headerRight}>
            <Button href={`/${slug}`} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
              New client
            </Button>
          </div>
        )}
      </header>

      {!mcKey && configured === null && <p className={s.muted}>Loading…</p>}

      {!mcKey && configured === false && (
        <section className={s.gate}>
          <h2>Set a password</h2>
          <p className={s.muted}>
            {tenant.name} doesn't have a dashboard password yet. Choose one now — you'll use it every time you come
            back.
          </p>
          <form onSubmit={submitCreatePassword} className={s.gateForm}>
            <input
              type="password"
              className={fieldStyles.control}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="New password (min. 8 characters)"
              aria-label="New Mission Control password"
              autoFocus
            />
            <input
              type="password"
              className={fieldStyles.control}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Confirm password"
              aria-label="Confirm Mission Control password"
            />
            <Button type="submit" disabled={checking || !passwordInput.trim() || !confirmInput.trim()}>
              {checking ? "Saving…" : "Set password"}
            </Button>
          </form>
          {authError && <div className={s.errorText}>{authError}</div>}
        </section>
      )}

      {!mcKey && configured === true && (
        <section className={s.gate}>
          <h2>Enter password</h2>
          <p className={s.muted}>This dashboard is restricted to the operations team.</p>
          <form onSubmit={submitPassword} className={s.gateForm}>
            <input
              type="password"
              className={fieldStyles.control}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              aria-label="Mission Control password"
              autoFocus
            />
            <Button type="submit" disabled={checking || !passwordInput.trim()}>
              {checking ? "Checking…" : "Enter"}
            </Button>
          </form>
          {authError && <div className={s.errorText}>{authError}</div>}
        </section>
      )}

      {mcKey && (
        <>
          <div className={s.linkRow}>
            <span className={s.muted}>Client onboarding link</span>
            <code className={s.linkCode}>{`${slug}.labhq.co`}</code>
            <Button variant="secondary" size="sm" onClick={copyLink}>
              {linkCopied ? "Copied" : "Copy link"}
            </Button>
          </div>

          <Card padded={false} className={s.brandingCard}>
            <Card.Header title="Branding" />
            <div style={{ padding: "0 20px 20px" }}>
              <div className={s.brandRow}>
                <span className={fieldStyles.label}>Favicon</span>
                <div className={s.brandRowBody}>
                  {assetInputs.favicon && <img className={s.assetPreview} src={assetInputs.favicon} alt="" />}
                  <Button as="label" variant="secondary" size="sm">
                    {assetStatus.favicon === "uploading" ? "Uploading…" : assetInputs.favicon ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept={FAVICON_ACCEPT}
                      onChange={(e) => e.target.files[0] && uploadAsset("favicon", e.target.files[0])}
                      hidden
                    />
                  </Button>
                  {assetStatus.favicon === "saved" && <span className={s.saved}>Saved</span>}
                </div>
                {assetStatus.favicon && !TRANSIENT_STATUSES.includes(assetStatus.favicon) ? (
                  <span className={fieldStyles.error}>{assetStatus.favicon}</span>
                ) : (
                  <span className={fieldStyles.help}>Square image, up to 2MB. Used as the browser tab icon.</span>
                )}
              </div>

              <div className={s.brandRow}>
                <span className={fieldStyles.label}>Logo</span>
                <div className={s.brandRowBody}>
                  {assetInputs.logo && <img className={`${s.assetPreview} ${s.assetPreviewLogo}`} src={assetInputs.logo} alt="" />}
                  <Button as="label" variant="secondary" size="sm">
                    {assetStatus.logo === "uploading" ? "Uploading…" : assetInputs.logo ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept={LOGO_ACCEPT}
                      onChange={(e) => e.target.files[0] && uploadAsset("logo", e.target.files[0])}
                      hidden
                    />
                  </Button>
                  {assetStatus.logo === "saved" && <span className={s.saved}>Saved</span>}
                </div>
                {assetStatus.logo && !TRANSIENT_STATUSES.includes(assetStatus.logo) ? (
                  <span className={fieldStyles.error}>{assetStatus.logo}</span>
                ) : (
                  <span className={fieldStyles.help}>
                    Up to 2MB. Shows on {tenant.name}'s intake page and dashboard — no redeploy needed.
                  </span>
                )}
              </div>
            </div>
          </Card>

          <section className={s.list}>
            {error && <div className={s.errorText}>{error}</div>}

            {deployments === null && <p className={s.muted}>Loading…</p>}

            {deployments && deployments.length === 0 && (
              <EmptyState
                title="No clients yet"
                description="They'll show up here the moment one lands."
              />
            )}

            {deployments && deployments.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Status</th>
                    <th className={s.progressCell}>Progress</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => {
                    const currentIndex = STATUS_STEPS.findIndex((st) => st.key === d.status);
                    const currentStep = STATUS_STEPS[currentIndex] || STATUS_STEPS[0];
                    const expanded = expandedIds.has(d.id);
                    return (
                      <Fragment key={d.id}>
                        <Table.Row interactive onClick={() => toggleExpanded(d.id)}>
                          <td>
                            <div className={s.rowMain}>
                              <span className={`${s.chevron} ${expanded ? s.chevronOpen : ""}`}>▸</span>
                              <span className={s.bizName}>{d.businessName || "Unnamed business"}</span>
                              {d.demo && <Badge tone="neutral" dot={false}>Demo</Badge>}
                              {d.locationAuthNeeded && <Badge tone="warning">Sync needed</Badge>}
                            </div>
                          </td>
                          <td>
                            <Badge tone={currentStep.tone}>{currentStep.label}</Badge>
                          </td>
                          <td className={s.progressCell}>
                            <ProgressBar
                              value={Math.max(currentIndex, 0)}
                              max={STATUS_STEPS.length - 1}
                              aria-label="Setup progress"
                            />
                          </td>
                          <td className={s.rowDate}>{formatDate(d.createdAt)}</td>
                        </Table.Row>

                        {expanded && (
                          <Table.ExpandRow colSpan={4}>
                            <div className={s.detail} onClick={(e) => e.stopPropagation()}>
                              <div>
                                <div className={s.detailLabel} style={{ marginBottom: 8 }}>
                                  Status
                                </div>
                                <div className={s.stepper} role="group" aria-label="Client status">
                                  {STATUS_STEPS.map((step, i) => (
                                    <button
                                      key={step.key}
                                      type="button"
                                      className={`${s.step} ${i < currentIndex ? s.done : i === currentIndex ? s.active : ""}`}
                                      onClick={() => setStatus(d.id, step.key)}
                                    >
                                      <span className={s.stepDot} />
                                      {step.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {d.locationAuthNeeded && (
                                <div>
                                  <div className={s.detailLabel} style={{ marginBottom: 8 }}>
                                    Data sync
                                  </div>
                                  <div className={s.syncActions}>
                                    <Button
                                      href={`/api/oauth/start?app=location&tenant=${slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="secondary"
                                      size="sm"
                                    >
                                      Authorise data sync
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled={retrySyncStatus[d.id] === "running"}
                                      onClick={() => retrySync(d.id)}
                                    >
                                      {retrySyncStatus[d.id] === "running" ? "Retrying…" : "Retry data sync"}
                                    </Button>
                                  </div>
                                  <p className={fieldStyles.help} style={{ marginTop: 8 }}>
                                    GHL doesn't let us preselect the location. When the picker opens, choose{" "}
                                    <strong>{d.businessName || "this business"}</strong>, then select Retry data
                                    sync.
                                  </p>
                                </div>
                              )}

                              <details
                                className={s.disclosure}
                                open={setupOpenIds.has(d.id)}
                                onToggle={() => toggleSetupExpanded(d.id)}
                              >
                                <summary>Setup details</summary>
                                <Tabs
                                  className={s.tabs}
                                  value={setupTab[d.id] || "answers"}
                                  onChange={(val) => setSetupTab((prevState) => ({ ...prevState, [d.id]: val }))}
                                  items={[
                                    { value: "answers", label: "Interview answers" },
                                    { value: "values", label: "Custom values" },
                                  ]}
                                />

                                {(setupTab[d.id] || "answers") === "answers" ? (
                                  !d.answers ? (
                                    <p className={s.muted}>Not recorded for this client.</p>
                                  ) : (
                                    <div className={s.kvList}>
                                      {INTERVIEW_FIELDS.map((f) => (
                                        <div className={s.kvRow} key={f.field}>
                                          <div className={s.kvLabel}>{f.ask}</div>
                                          <div className={s.kvValue}>{d.answers[f.field] || "—"}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                ) : !d.customValues ? (
                                  <p className={s.muted}>Not recorded for this client.</p>
                                ) : (
                                  <>
                                    <div className={s.copyAllRow}>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                          copyRow(
                                            `${d.id}:all`,
                                            CUSTOM_VALUE_KEYS.map((key) => `${key}: ${d.customValues[key] ?? ""}`).join(
                                              "\n"
                                            )
                                          )
                                        }
                                      >
                                        {copyLabel(`${d.id}:all`, "Copy all")}
                                      </Button>
                                    </div>
                                    <div className={s.kvList}>
                                      {CUSTOM_VALUE_KEYS.map((key) => (
                                        <div className={s.kvRow} key={key}>
                                          <div className={s.kvLabel}>{key.replaceAll("_", " ")}</div>
                                          <div className={s.kvValue}>{d.customValues[key] ?? ""}</div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyRow(`${d.id}:${key}`, String(d.customValues[key] ?? ""))}
                                          >
                                            {copyLabel(`${d.id}:${key}`, "Copy")}
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </details>

                              <details
                                className={s.disclosure}
                                open={qaOpenIds.has(d.id)}
                                onToggle={() => toggleQaExpanded(d.id)}
                              >
                                <summary>QA checklist</summary>
                                <ol className={s.checklist}>
                                  {QA_CHECKLIST.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ol>
                              </details>
                            </div>
                          </Table.ExpandRow>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </section>
        </>
      )}
    </main>
  );
}
