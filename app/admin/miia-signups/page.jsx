"use client";
import { useEffect, useState } from "react";
import { Table, Badge, Button, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "../admin.module.css";

const CHECKLIST_ITEMS = [
  { id: "consentClick", label: "Consent" },
  { id: "channelsWired", label: "Channels" },
  { id: "numberPurchased", label: "Number" },
  { id: "bundleSubmitted", label: "Bundle" },
  { id: "day2Check", label: "Day-2" },
];

const PLAN_LABEL = { chat: "Miia Chat", everywhere: "Miia Everywhere", complete: "Miia Complete" };

function ChecklistChip({ signup, item, onToggle }) {
  const on = Boolean(signup.checklist?.[item.id]);
  return (
    <button
      type="button"
      onClick={() => onToggle(signup.id, item.id, !on)}
      title={item.label}
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 999,
        border: "1px solid " + (on ? "var(--success-border)" : "var(--line)"),
        background: on ? "var(--success-bg)" : "transparent",
        color: on ? "var(--success)" : "var(--muted)",
        cursor: "pointer",
      }}
    >
      {item.label}
    </button>
  );
}

function statusBadge(status) {
  if (status === "success" || status === "complete" || status === "live") return <Badge tone="success">{status}</Badge>;
  if (status === "failed") return <Badge tone="danger">failed</Badge>;
  if (status === "not_started") return <Badge tone="neutral">not started</Badge>;
  return <Badge tone="warning">{status}</Badge>;
}

const HEALTHCARE_SOURCE_LABEL = {
  signup: "via /allied-health signup",
  "intake-classifier": "via intake classifier",
  manual: "manual override",
};

function WelcomeEmailCell({ signup, busy, onResend }) {
  if (!signup.tenantSlug) return <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>;
  const sent = Boolean(signup.welcomeEmailSentAt);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <Badge tone={sent ? "success" : "danger"}>{sent ? "Sent" : "Not sent"}</Badge>
      {sent && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(signup.welcomeEmailSentAt).toLocaleString()}</span>
      )}
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => onResend(signup)}>
        {busy ? "Sending…" : sent ? "Resend" : "Send now"}
      </Button>
    </div>
  );
}

function HealthcareCell({ signup, busy, onToggle }) {
  if (!signup.tenantSlug) return <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>;
  const on = Boolean(signup.healthcareMode);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <Badge tone={on ? "accent" : "neutral"}>{on ? "Healthcare mode ON" : "Healthcare mode off"}</Badge>
      {signup.healthcareModeSource && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{HEALTHCARE_SOURCE_LABEL[signup.healthcareModeSource] || signup.healthcareModeSource}</span>
      )}
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => onToggle(signup, !on)}>
        {busy ? "…" : on ? "Turn off" : "Turn on"}
      </Button>
    </div>
  );
}

export default function MiiaSignupsPage() {
  const toast = useToast();
  const [signups, setSignups] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [togglingHealthcare, setTogglingHealthcare] = useState(null);
  const [resendingWelcome, setResendingWelcome] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [emailFailures, setEmailFailures] = useState([]);

  function load(includeArchived = showArchived) {
    adminFetch(`/api/admin/miia-signups${includeArchived ? "?includeArchived=true" : ""}`)
      .then((data) => setSignups(data.signups || []))
      .catch((e) => toast.push(e.message, "error"));
  }

  useEffect(() => load(showArchived), [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    adminFetch("/api/admin/email-failures")
      .then((data) => setEmailFailures(data.failures || []))
      .catch(() => {});
  }, []);

  function resendWelcome(signup) {
    setResendingWelcome(signup.id);
    adminFetch(`/api/admin/miia-signups/${signup.id}/resend-welcome`, { method: "POST" })
      .then(({ signup: updated }) => {
        setSignups((prev) => prev.map((s) => (s.id === signup.id ? { ...s, ...updated } : s)));
        toast.push(
          updated.welcomeEmailSentAt ? `Welcome email sent to ${updated.email}` : "Still failing - check the red banner above for the error",
          updated.welcomeEmailSentAt ? "success" : "error"
        );
      })
      .catch((e) => toast.push(e.message, "error"))
      .finally(() => setResendingWelcome(null));
  }

  function toggleChecklist(id, item, value) {
    setSignups((prev) => prev.map((s) => (s.id === id ? { ...s, checklist: { ...s.checklist, [item]: value } } : s)));
    adminFetch(`/api/admin/miia-signups/${id}/checklist`, { method: "PATCH", body: { item, value } }).catch((e) => {
      toast.push(e.message, "error");
      load();
    });
  }

  function retry(id) {
    setRetrying(id);
    adminFetch(`/api/admin/miia-signups/${id}/retry`, { method: "POST" })
      .then(({ signup }) => {
        setSignups((prev) => prev.map((s) => (s.id === id ? { ...s, ...signup } : s)));
        toast.push(
          signup.provisioningStatus === "success" ? `Provisioned ${signup.tenantSlug}` : "Still failing - see server logs",
          signup.provisioningStatus === "success" ? "success" : "error"
        );
      })
      .catch((e) => toast.push(e.message, "error"))
      .finally(() => setRetrying(null));
  }

  function toggleHealthcare(signup, enabled) {
    setTogglingHealthcare(signup.id);
    adminFetch(`/api/admin/tenants/${signup.tenantSlug}/healthcare-mode`, { method: "POST", body: { enabled } })
      .then(() => {
        setSignups((prev) =>
          prev.map((s) => (s.id === signup.id ? { ...s, healthcareMode: enabled, healthcareModeSource: "manual" } : s))
        );
        toast.push(`Healthcare mode ${enabled ? "turned on" : "turned off"} for ${signup.businessName}`, "success");
      })
      .catch((e) => toast.push(e.message, "error"))
      .finally(() => setTogglingHealthcare(null));
  }

  function archive(id, restore) {
    setArchiving(id);
    adminFetch(`/api/admin/miia-signups/${id}/archive`, { method: "POST", body: { restore } })
      .then(() => {
        toast.push(restore ? "Restored" : "Archived", "success");
        load();
      })
      .catch((e) => toast.push(e.message, "error"))
      .finally(() => setArchiving(null));
  }

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Miia signups</h1>
        <p className={s.pageSubtitle}>Every paid Miia checkout, provisioning status, and the go-live checklist.</p>
      </div>

      {emailFailures.length > 0 && (
        <div
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {emailFailures.length} email send{emailFailures.length === 1 ? "" : "s"} failed in the last 24 hours. Most
          recent: <strong>{emailFailures[0].context}</strong> to {emailFailures[0].to || "unknown"}, error:{" "}
          {emailFailures[0].error}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived (test tenants)
      </label>

      <Table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Plan</th>
            <th>Paid</th>
            <th>Provisioning</th>
            <th>Intake</th>
            <th>Deploy</th>
            <th>Welcome email</th>
            <th>Healthcare</th>
            <th>Checklist</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(signups || []).map((sg) => (
            <Table.Row key={sg.id}>
              <td>
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {sg.businessName || "—"}
                  {sg.archived && <Badge tone="neutral">Archived</Badge>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {sg.contactName ? `${sg.contactName} · ` : ""}
                  {sg.email}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{sg.phone}</div>
              </td>
              <td>
                <div>{PLAN_LABEL[sg.plan] || sg.plan}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {sg.founding ? "Founding" : "Standard"} · {sg.billingPeriod}
                  {sg.whiteGlove ? " · White glove" : ""}
                </div>
              </td>
              <td style={{ fontSize: 13 }}>{sg.paidAt ? new Date(sg.paidAt).toLocaleString() : "—"}</td>
              <td>
                {statusBadge(sg.provisioningStatus)}
                {sg.provisioningStatus === "failed" && (
                  <div style={{ marginTop: 6 }}>
                    <Button variant="secondary" size="sm" disabled={retrying === sg.id} onClick={() => retry(sg.id)}>
                      {retrying === sg.id ? "Retrying…" : "Retry"}
                    </Button>
                  </div>
                )}
              </td>
              <td>{statusBadge(sg.intakeStatus)}</td>
              <td>{statusBadge(sg.deployStatus)}</td>
              <td>
                <WelcomeEmailCell signup={sg} busy={resendingWelcome === sg.id} onResend={resendWelcome} />
              </td>
              <td>
                <HealthcareCell signup={sg} busy={togglingHealthcare === sg.id} onToggle={toggleHealthcare} />
              </td>
              <td>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 220 }}>
                  {CHECKLIST_ITEMS.map((item) => (
                    <ChecklistChip key={item.id} signup={sg} item={item} onToggle={toggleChecklist} />
                  ))}
                </div>
              </td>
              <td>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                  {sg.tenantSlug && (
                    <a href={`/${sg.tenantSlug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                      View chat
                    </a>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={archiving === sg.id}
                    onClick={() => archive(sg.id, sg.archived)}
                  >
                    {archiving === sg.id ? "…" : sg.archived ? "Restore" : "Archive"}
                  </Button>
                </div>
              </td>
            </Table.Row>
          ))}
          {signups && signups.length === 0 && (
            <tr>
              <td colSpan={10} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No signups yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
