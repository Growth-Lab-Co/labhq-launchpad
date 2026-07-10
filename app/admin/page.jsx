"use client";
import { useEffect, useState } from "react";
import { Table, Badge, Button, Modal, Input, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "./admin.module.css";

export default function AdminTenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    adminFetch("/api/admin/tenants")
      .then((data) => setTenants(data.tenants || []))
      .catch((e) => toast.push(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retryDomainAlias(slug) {
    setRetrying(slug);
    adminFetch(`/api/admin/tenants/${slug}/retry-domain-alias`, { method: "POST" })
      .then(({ account }) => {
        setTenants((prev) => prev.map((t) => (t.slug === slug ? { ...t, account } : t)));
        toast.push(
          account.domainAlias?.status === "ok" ? `${slug}.labhq.co registered` : "Still failing - see server logs",
          account.domainAlias?.status === "ok" ? "success" : "error"
        );
      })
      .catch((e) => toast.push(e.message, "error"))
      .finally(() => setRetrying(null));
  }

  function closeRemoveModal() {
    setRemoveTarget(null);
    setConfirmText("");
  }

  function confirmRemove() {
    const slug = removeTarget.slug;
    setRemoving(true);
    adminFetch(`/api/admin/tenants/${slug}`, { method: "DELETE", body: { confirmSlug: confirmText } })
      .then(() => {
        setTenants((prev) => prev.filter((t) => t.slug !== slug));
        toast.push(`${slug}.labhq.co removed`, "success");
        closeRemoveModal();
      })
      .catch((e) => toast.push(e.message, "error"))
      .finally(() => setRemoving(false));
  }

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Tenants</h1>
        <p className={s.pageSubtitle}>Every door on the platform, hand-onboarded or self-serve.</p>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Type</th>
            <th>Portal account</th>
            <th>Onboarding</th>
            <th>Domain</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(tenants || []).map((t) => (
            <Table.Row key={t.slug}>
              <td>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.slug}.labhq.co</div>
              </td>
              <td>
                <Badge tone={t.isSeed ? "neutral" : "accent"}>{t.isSeed ? "Hand-onboarded" : "Self-serve"}</Badge>
              </td>
              <td>
                {t.account ? (
                  <div>
                    <div>{t.account.agencyName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.account.contactEmail}</div>
                  </div>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>No account</span>
                )}
              </td>
              <td>
                {t.account ? (
                  t.account.onboarding?.completedAt ? (
                    <Badge tone="success">Complete</Badge>
                  ) : (
                    <Badge tone="warning">In progress</Badge>
                  )
                ) : (
                  <span style={{ color: "var(--muted-2)", fontSize: 13 }}>—</span>
                )}
              </td>
              <td>
                {t.isSeed ? (
                  <span style={{ color: "var(--muted-2)", fontSize: 13 }}>—</span>
                ) : t.account?.domainAlias?.status === "ok" ? (
                  <Badge tone="success">Registered</Badge>
                ) : t.account?.domainAlias?.status === "failed" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tone="danger">Alias failed</Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={retrying === t.slug}
                      onClick={() => retryDomainAlias(t.slug)}
                    >
                      {retrying === t.slug ? "Retrying…" : "Retry"}
                    </Button>
                  </div>
                ) : (
                  <span style={{ color: "var(--muted-2)", fontSize: 13 }}>—</span>
                )}
              </td>
              <td>
                {!t.isSeed && (
                  <Button variant="destructive" size="sm" onClick={() => setRemoveTarget(t)}>
                    Remove
                  </Button>
                )}
              </td>
            </Table.Row>
          ))}
          {tenants && tenants.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No tenants yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal
        open={Boolean(removeTarget)}
        onClose={removing ? undefined : closeRemoveModal}
        title={removeTarget ? `Remove ${removeTarget.slug}.labhq.co` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={closeRemoveModal} disabled={removing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removing || confirmText !== removeTarget?.slug}
              onClick={confirmRemove}
            >
              {removing ? "Removing…" : "Remove permanently"}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 var(--space-4)" }}>
          This permanently deletes the tenant record, its portal account, and every piece of its stored data
          (branding, checklists, activity, deployments, GHL connections) - and de-registers{" "}
          <strong>{removeTarget?.slug}.labhq.co</strong> from Netlify. This can't be undone.
        </p>
        <Input
          label={`Type "${removeTarget?.slug}" to confirm`}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoFocus
          disabled={removing}
        />
      </Modal>
    </>
  );
}
