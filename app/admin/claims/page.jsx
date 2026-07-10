"use client";
import { useEffect, useState } from "react";
import { Card, Input, Button, Badge, Table, Select, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "../admin.module.css";

export default function ClaimsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState([]);
  const [links, setLinks] = useState([]);
  const [tenantSlug, setTenantSlug] = useState("");
  const [planLabel, setPlanLabel] = useState("Founding partner");
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  async function refetch() {
    try {
      const [tenantData, linkData] = await Promise.all([
        adminFetch("/api/admin/tenants"),
        adminFetch("/api/admin/claims"),
      ]);
      setTenants(tenantData.tenants || []);
      setLinks(linkData.links || []);
    } catch (e) {
      toast.push(e.message, "error");
    }
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminFetch("/api/admin/claims", { method: "POST", body: { tenantSlug, planLabel } });
      toast.push("Claim link ready", "success");
      refetch();
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(token) {
    const url = `${window.location.origin}/portal/claim/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Clipboard denied - the field text is still visible to copy manually.
    }
  }

  const unclaimedTenants = tenants.filter((t) => !t.account);

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Claim links</h1>
        <p className={s.pageSubtitle}>
          Generate a one-time link so an existing hand-onboarded tenant can adopt the portal without redoing setup.
        </p>
      </div>

      <div className={s.section}>
        <form onSubmit={submit} className={s.sectionForm}>
          <Select
            label="Tenant"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            required
          >
            <option value="">Select a tenant…</option>
            {unclaimedTenants.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name} ({t.slug})
              </option>
            ))}
          </Select>
          <Input label="Plan label" value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} />
          <Button type="submit" disabled={submitting || !tenantSlug}>
            {submitting ? "Generating…" : "Generate link"}
          </Button>
        </form>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Plan label</th>
            <th>Status</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <Table.Row key={link.token}>
              <td>{link.tenantSlug}</td>
              <td>{link.planLabel}</td>
              <td>
                {link.usedAt ? (
                  <Badge tone="neutral">Claimed</Badge>
                ) : link.expiresAt < Date.now() ? (
                  <Badge tone="warning">Expired</Badge>
                ) : (
                  <Badge tone="success">Active</Badge>
                )}
              </td>
              <td>
                {!link.usedAt && (
                  <div className={s.copyRow}>
                    <span className={s.copyField}>/portal/claim/{link.token}</span>
                    <Button variant="secondary" size="sm" onClick={() => copyLink(link.token)}>
                      {copiedToken === link.token ? "Copied" : "Copy"}
                    </Button>
                  </div>
                )}
              </td>
            </Table.Row>
          ))}
          {links.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No claim links yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
