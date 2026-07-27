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

export default function MiiaSignupsPage() {
  const toast = useToast();
  const [signups, setSignups] = useState(null);
  const [retrying, setRetrying] = useState(null);

  function load() {
    adminFetch("/api/admin/miia-signups")
      .then((data) => setSignups(data.signups || []))
      .catch((e) => toast.push(e.message, "error"));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Miia signups</h1>
        <p className={s.pageSubtitle}>Every paid Miia checkout, provisioning status, and the go-live checklist.</p>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Plan</th>
            <th>Paid</th>
            <th>Provisioning</th>
            <th>Intake</th>
            <th>Deploy</th>
            <th>Checklist</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(signups || []).map((sg) => (
            <Table.Row key={sg.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{sg.businessName || "—"}</div>
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 220 }}>
                  {CHECKLIST_ITEMS.map((item) => (
                    <ChecklistChip key={item.id} signup={sg} item={item} onToggle={toggleChecklist} />
                  ))}
                </div>
              </td>
              <td>
                {sg.tenantSlug && (
                  <a href={`/${sg.tenantSlug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                    View chat
                  </a>
                )}
              </td>
            </Table.Row>
          ))}
          {signups && signups.length === 0 && (
            <tr>
              <td colSpan={8} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No signups yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
